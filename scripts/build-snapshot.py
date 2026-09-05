"""Rebuild an auditable research snapshot. Python 3.11+ and pypdf required.

The upstream commit is pinned; replace --revision explicitly to update disclosures.
Source prices are for personal research. Review provider terms before redistribution.
"""
import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import io
import json
import pathlib
import re
import time
import urllib.request
import zipfile
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'research'
CACHE.mkdir(parents=True, exist_ok=True)
REVISION = '464910341dbc9001387b3d5b96585bf1bc8c4e87'
MEMBERS = ['house_nancy_pelosi', 'house_marjorietaylor_greene', 'house_daniel_crenshaw']

def fetch(url, refresh=False):
    path = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if path.exists() and not refresh:
        return path.read_bytes()
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 DisclosureLabResearch/1.0'})
            with urllib.request.urlopen(req, timeout=40) as response:
                data = response.read()
            path.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def iso(value):
    return dt.datetime.strptime(value, '%m/%d/%Y').date().isoformat()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', default=REVISION)
    parser.add_argument('--as-of', default='2026-09-04')
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    end = dt.date.fromisoformat(args.as_of)
    if not re.fullmatch(r'[a-f0-9]{40}', args.revision):
        raise ValueError('A full upstream commit hash is required')
    upstream = f'https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/{args.revision}'
    members, records, documents, issues = [], [], {}, []
    indices = {}
    for year in range(2020, end.year + 1):
        url = f'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip'
        archive = zipfile.ZipFile(io.BytesIO(fetch(url, args.refresh)))
        rows = csv.DictReader(io.StringIO(archive.read(f'{year}FD.txt').decode('utf-8-sig')), delimiter='\t')
        for row in rows:
            indices[row['DocID']] = row
    for member in MEMBERS:
        payload = json.loads(fetch(f'{upstream}/public/data/filer/{member}.json'))
        members.append({'id': member, 'name': payload['filer']['full_name'], 'party': payload['filer']['party'], 'state': payload['filer']['state']})
        for row in payload['trades']:
            if not ('2020-01-01' <= row['transaction_date'] <= args.as_of and row['filing_date'] <= args.as_of):
                continue
            doc = row['doc_url'] or ''
            docid = doc.rsplit('/', 1)[-1].replace('.pdf', '')
            index = indices.get(docid)
            reason = None
            if not index or iso(index['FilingDate']) != row['filing_date']:
                reason = 'Filing date could not be matched to official index'
            elif row['transaction_type'] != 'Purchase':
                reason = 'Sale / other transaction; purchase-only strategy'
            elif row['asset_type'] not in ('ST', None):
                reason = 'Option, other asset, or unclassified security'
            elif not row['ticker'] or not re.fullmatch(r'[A-Z]{1,5}(?:[.-][A-Z])?', row['ticker']):
                reason = 'Unresolved security symbol'
            elif re.search(r'exercis|convers|transfer|gift|donat|merger', row.get('comment') or '', re.I):
                reason = 'Option exercise or non-market transfer'
            records.append({'id': row['id'], 'member': member, 'ticker': row['ticker'], 'asset': row['asset_name'], 'assetType': row['asset_type'], 'type': row['transaction_type'], 'owner': row['owner'], 'transactionDate': row['transaction_date'], 'filingDate': row['filing_date'], 'amountLow': row['amount_range_low'], 'amountHigh': row['amount_range_high'], 'amountLabel': row['amount_range_label'], 'description': row.get('comment') or '', 'source': doc, 'exclusion': reason, 'verification': 'index matched' if index else 'unmatched'})

    urls = sorted({r['source'] for r in records if r['exclusion'] is None})
    def document(url):
        try:
            raw = fetch(url)
            text = '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(raw)).pages).replace('\x00', '')
            return url, {'sha256': hashlib.sha256(raw).hexdigest(), 'text': text}
        except Exception as exc:
            return url, {'error': str(exc)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for url, value in pool.map(document, urls):
            documents[url] = value
    for row in records:
        if row['exclusion']:
            continue
        doc = documents[row['source']]
        text = doc.get('text', '')
        # Restrict evidence to the exact ticker's asset block and matching date.
        anchors = list(re.finditer(r'\(([A-Za-z.\-]{1,6})\)\s*\[([A-Za-z]{2})\]', text))
        matches = []
        for i, anchor in enumerate(anchors):
            segment = text[anchor.end():anchors[i+1].start() if i+1 < len(anchors) else len(text)]
            date_text = dt.date.fromisoformat(row['transactionDate']).strftime('%m/%d/%Y')
            if anchor.group(1).upper() == row['ticker'] and anchor.group(2).upper() == 'ST' and date_text in segment:
                matches.append(segment)
        if len(matches) != 1:
            row['exclusion'] = 'Source row ambiguous or PDF extraction could not verify it'
        elif re.search(r'exercis|convers|transfer|gift|donat|merger', matches[0], re.I):
            row['exclusion'] = 'Option exercise or non-market transfer in source PDF'
        elif not re.match(r'\s*P\s', matches[0]):
            row['exclusion'] = 'Purchase direction could not be verified in source PDF'
        else:
            amounts = re.findall(r'\$([\d,]+)', matches[0])[:2]
            expected = [row['amountLow'], row['amountHigh']]
            if len(amounts) != 2 or [int(a.replace(',', '')) for a in amounts] != expected:
                row['exclusion'] = 'Reported amount range could not be verified in source PDF'
                continue
            row['assetType'] = 'ST'
            row['verification'] = 'official PDF ticker / type / date matched'
            row['sourceHash'] = doc['sha256']
            row['evidence'] = ' '.join(matches[0].split())[:700]
    # Possible duplicates/amendments are excluded conservatively, never silently double-counted.
    seen = set()
    for row in sorted(records, key=lambda r: (r['filingDate'], r['id'])):
        if row['exclusion']:
            continue
        key = (row['member'], row['ticker'], row['transactionDate'], row['owner'], row['amountLow'], row['amountHigh'])
        if key in seen:
            row['exclusion'] = 'Possible duplicate / amended disclosure'
        seen.add(key)
    tickers = sorted({r['ticker'] for r in records if r['exclusion'] is None} | {'SPY', 'QQQ'})
    print(f'{len(records)} disclosures; {sum(r["exclusion"] is None for r in records)} verified purchase rows; {len(tickers)} price series', flush=True)
    start_ts = int(dt.datetime(2019, 12, 1, tzinfo=dt.timezone.utc).timestamp())
    end_ts = int(dt.datetime.combine(end + dt.timedelta(days=1), dt.time(), tzinfo=dt.timezone.utc).timestamp())
    def prices(ticker):
        try:
            symbol = ticker.replace('.', '-')
            url = f'https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?period1={start_ts}&period2={end_ts}&interval=1d&events=div%2Csplits&includeAdjustedClose=true'
            raw = fetch(url, args.refresh)
            result = json.loads(raw)['chart']['result'][0]
            quote = result['indicators']['quote'][0]
            adjusted = result['indicators']['adjclose'][0]['adjclose']
            bars = []
            for i, timestamp in enumerate(result['timestamp']):
                date = dt.datetime.fromtimestamp(timestamp, dt.timezone.utc).date().isoformat()
                values = [quote['open'][i], quote['close'][i], adjusted[i]]
                if date > args.as_of or any(v is None or v <= 0 for v in values):
                    continue
                # Yahoo OHLC is split-adjusted. Apply adjclose/close for dividend-adjusted total-return units.
                ratio = values[2] / values[1]
                bars.append([date, round(values[0] * ratio, 8), round(values[2], 8)])
            return ticker, {'bars': bars, 'source': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'currency': result['meta']['currency'], 'instrument': result['meta']['instrumentType']}
        except Exception as exc:
            return ticker, {'error': str(exc)}
    price_data = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for ticker, data in pool.map(prices, tickers):
            if 'error' in data:
                issues.append({'ticker': ticker, 'reason': data['error']})
            else:
                price_data[ticker] = data
            print(f'Prices {ticker}: {len(data.get("bars", []))} rows', flush=True)
    for row in records:
        if row['exclusion'] is None and row['ticker'] not in price_data:
            row['exclusion'] = 'Historical price series unavailable'
        elif row['exclusion'] is None and (price_data[row['ticker']]['instrument'] != 'EQUITY' or price_data[row['ticker']]['currency'] != 'USD'):
            row['exclusion'] = 'Non-equity or non-USD price series; outside supported universe'
    if not all(t in price_data for t in ['SPY', 'QQQ']):
        raise RuntimeError('Benchmark price download failed; snapshot not published')
    manifest = {'schemaVersion': 1, 'asOf': args.as_of, 'builtAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'upstreamRevision': args.revision, 'upstream': upstream, 'priceConvention': 'Dividend- and split-adjusted open / close research units; estimated total returns', 'disclosureConvention': 'Official index filing date is a public-availability proxy; original publication timestamps unavailable', 'coverage': 'Three selected House filers, transaction dates from 2020; upstream snapshot is not guaranteed complete', 'priceIssues': issues, 'officialDocumentsChecked': len(documents)}
    output = ROOT / 'public' / 'data'
    output.mkdir(parents=True, exist_ok=True)
    snapshot = {'manifest': manifest, 'members': members, 'trades': records, 'prices': price_data}
    payload = json.dumps(snapshot, separators=(',', ':'), allow_nan=False)
    (output / 'snapshot.json').write_text(payload)
    # Portable filing-only artifact can be published separately from provider price data.
    (output / 'disclosures.json').write_text(json.dumps({'manifest': manifest, 'members': members, 'trades': records}, indent=2))
    print(f'Snapshot saved: {len(payload):,} bytes; eligible: {sum(r["exclusion"] is None for r in records)}', flush=True)

if __name__ == '__main__':
    main()
