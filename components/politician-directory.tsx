'use client';
import { useMemo, useState } from 'react';
import {
  Search,
  Users,
  ArrowUpRight,
  CheckCircle2,
  Code2,
  BookOpen,
  FlaskConical,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import directoryData from '@/public/data/directory.json';

export type DirectoryMember = {
  id: string;
  name: string;
  photo: string | null;
  photoSource: string;
  chambers: string[];
  states: string[];
  parties: string[];
  profiles: { id: string; name: string; chamber: string; source: string }[];
  identityCorrections: { reason: string; source: string }[];
  backtestMember: string | null;
  eligible: number;
};
const directory: {
  manifest: typeof directoryData.manifest;
  members: DirectoryMember[];
} = directoryData;
export function memberForExperiment(id: string) {
  return directory.members.find((m) => m.backtestMember === id);
}
export function Portrait({
  member,
  className = '',
}: {
  member: DirectoryMember;
  className?: string;
}) {
  return (
    <Avatar className={`politician-portrait ${className}`}>
      {member.photo && (
        <AvatarImage
          src={member.photo}
          alt={`Portrait of ${member.name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback aria-label={`Portrait unavailable for ${member.name}`}>
        {member.name
          .split(' ')
          .filter(Boolean)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')}
      </AvatarFallback>
    </Avatar>
  );
}
const partyLabel = (p: string) =>
  p === 'D'
    ? 'Democrat'
    : p === 'R'
      ? 'Republican'
      : p === 'I'
        ? 'Independent'
        : p;

export default function PoliticianDirectory({
  onChoose,
}: {
  onChoose: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [chamber, setChamber] = useState('all');
  const [party, setParty] = useState('all');
  const [coverage, setCoverage] = useState('all');
  const [limit, setLimit] = useState(36);
  const members = useMemo(
    () =>
      directory.members.filter(
        (m) =>
          (chamber === 'all' || m.chambers.includes(chamber)) &&
          (party === 'all' || m.parties.includes(party)) &&
          (coverage === 'all' ||
            (coverage === 'ready'
              ? Boolean(m.backtestMember)
              : !m.backtestMember)) &&
          `${m.name} ${m.states.join(' ')} ${m.profiles.map((p) => p.name).join(' ')}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [query, chamber, party, coverage],
  );
  return (
    <section className="directory" aria-labelledby="directory-title">
      <div className="directory-heading">
        <div>
          <p className="eyebrow">
            <Users size={15} /> THE PEOPLE BEHIND THE FILINGS
          </p>
          <h2 id="directory-title">Explore the directory.</h2>
          <p>
            {directory.members.length} profiles across House and Senate
            disclosure history. Includes former members.
          </p>
        </div>
        <div className="directory-counter">
          <strong>{directory.manifest.portraits}</strong>
          <span>available portraits</span>
        </div>
      </div>
      <div className="directory-note">
        <BookOpen size={19} />
        <p>
          <strong>A directory, not a performance leaderboard.</strong> Only the
          three PDF-checked filers are backtest ready. Other profiles link to
          source records; no return is calculated from unverified data. Party
          and state are historical source labels, not a current-office claim.
        </p>
      </div>
      <div className="directory-filters">
        <label className="directory-search" htmlFor="people-search">
          <Search size={18} />
          <Input
            id="people-search"
            placeholder="Search name or state abbreviation…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(36);
            }}
          />
        </label>
        <label className="control" htmlFor="people-chamber">
          <span>Chamber</span>
          <NativeSelect
            id="people-chamber"
            value={chamber}
            onChange={(e) => {
              setChamber(e.target.value);
              setLimit(36);
            }}
          >
            <option value="all">House + Senate</option>
            <option value="house">House</option>
            <option value="senate">Senate</option>
          </NativeSelect>
        </label>
        <label className="control" htmlFor="people-party">
          <span>Party</span>
          <NativeSelect
            id="people-party"
            value={party}
            onChange={(e) => {
              setParty(e.target.value);
              setLimit(36);
            }}
          >
            <option value="all">All parties</option>
            <option value="D">Democrat</option>
            <option value="R">Republican</option>
            <option value="I">Independent</option>
          </NativeSelect>
        </label>
        <label className="control" htmlFor="people-coverage">
          <span>Coverage</span>
          <NativeSelect
            id="people-coverage"
            value={coverage}
            onChange={(e) => {
              setCoverage(e.target.value);
              setLimit(36);
            }}
          >
            <option value="all">All profiles</option>
            <option value="ready">Backtest ready</option>
            <option value="directory">Directory only</option>
          </NativeSelect>
        </label>
      </div>
      <output className="directory-result-count">
        {members.length} matching profiles · ready-to-test first, then
        alphabetical
      </output>
      <div className="people-grid">
        {members.slice(0, limit).map((m) => (
          <article
            className={`person-card ${m.backtestMember ? 'person-ready' : ''}`}
            key={m.id}
          >
            <div className="person-heading">
              <Portrait member={m} />
              <div>
                <h3>{m.name}</h3>
                <p>
                  {m.chambers
                    .map((c) => (c === 'house' ? 'House' : 'Senate'))
                    .join(' / ')}
                  {m.states.length ? ` · ${m.states.join(' / ')}` : ''}
                </p>
                <span
                  className={`party-pill ${m.parties.length === 1 ? m.parties[0] : ''}`}
                >
                  {m.parties.map(partyLabel).join(' / ') ||
                    'Party not specified'}
                </span>
              </div>
            </div>
            <div className={`coverage-line ${m.backtestMember ? 'ready' : ''}`}>
              {m.backtestMember ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>{m.eligible} eligible stock purchases</span>
                </>
              ) : (
                <>
                  <BookOpen size={15} />
                  <span>
                    {m.id === 'senate_a_mitchell'
                      ? 'Source identity incomplete'
                      : 'Directory only · not backtested'}
                  </span>
                </>
              )}
            </div>
            {!m.photo && (
              <p className="portrait-missing">
                Portrait unavailable; initials shown.
              </p>
            )}
            <div className="person-actions">
              {m.backtestMember ? (
                <Button
                  variant="outline"
                  onClick={() => onChoose(m.backtestMember!)}
                >
                  <FlaskConical size={15} /> Open backtest
                </Button>
              ) : (
                <a href={m.profiles[0].source} target="_blank" rel="noreferrer">
                  View source records <ArrowUpRight size={14} />
                </a>
              )}
              <details className="person-sources">
                <summary>Sources</summary>
                <div>
                  {m.profiles.map((p) => (
                    <a
                      key={p.id}
                      href={p.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.name} · {p.chamber} ↗
                    </a>
                  ))}
                  {m.photo && (
                    <a href={m.photoSource} target="_blank" rel="noreferrer">
                      Portrait provenance ↗
                    </a>
                  )}
                  {m.identityCorrections.map((c) => (
                    <a
                      key={c.reason}
                      href={c.source}
                      target="_blank"
                      rel="noreferrer"
                      title={c.reason}
                    >
                      Identity correction & evidence ↗
                    </a>
                  ))}
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
      {!members.length && (
        <div className="directory-empty">
          <Search size={28} />
          <h3>No matching profiles</h3>
          <p>Try another name, state abbreviation or filter.</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setChamber('all');
              setParty('all');
              setCoverage('all');
              setLimit(36);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {members.length > limit && (
        <div className="directory-more">
          <Button variant="outline" onClick={() => setLimit((n) => n + 72)}>
            Show {Math.min(72, members.length - limit)} more profiles
          </Button>
          <span>
            Showing {Math.min(limit, members.length)} of {members.length}
          </span>
        </div>
      )}
      <p className="directory-provenance">
        From {directory.manifest.sourceProfiles} upstream congressional
        profiles. Matching portrait identifiers consolidate aliases and
        House/Senate histories; source profiles remain linked.{' '}
        <a href="/data/directory.json" target="_blank" rel="noreferrer">
          Directory data & provenance ↗
        </a>
      </p>
    </section>
  );
}

export function FrameworkGuide() {
  const stack = [
    [
      'Backtesting logic',
      'Custom TypeScript',
      'Our own daily event-driven engine: cash, fractional positions, entry/exit costs, holding windows, missing-price exclusions and portfolio accounting. No Backtrader, vectorbt or QuantConnect.',
    ],
    [
      'Website',
      'React 19 + Vinext',
      'React renders the interactive controls. Vinext provides Next.js-style routing and builds the application with Vite.',
    ],
    [
      'Charts',
      'Recharts',
      'Draws the equity curves from engine results. It does not calculate investment performance.',
    ],
    [
      'Interface components',
      'shadcn + Base UI',
      'Tabs, inputs, tables, buttons and portraits, with custom CSS and Tailwind styling. Lucide supplies interface icons.',
    ],
    [
      'Data preparation',
      'Python + pypdf',
      'Retrieves the pinned input, extracts original House PDFs, checks selected fields and builds a historical research snapshot.',
    ],
    [
      'Price history',
      'Yahoo Finance daily bars',
      'An external data source, not our engine. Adjusted prices estimate total returns; exact brokerage fills are unknown.',
    ],
    [
      'Testing',
      'Node’s built-in test runner',
      'Hand-checkable unit tests plus 24 real-data experiment checks. TypeScript checks types; tests do not guarantee financial accuracy.',
    ],
    [
      'Hosting & headless runs',
      'Sites / Cloudflare Workers + Node',
      'The website computes in your browser. The same engine runs from the command line on a server. No separate trading API or database is required.',
    ],
  ];
  return (
    <section className="framework-guide">
      <p className="eyebrow">
        <Code2 size={15} /> UNDER THE HOOD
      </p>
      <h2>Our engine. Established tools around it.</h2>
      <p className="framework-intro">
        The backtest is custom-built, not a reskinned trading library. That
        makes its rules easy to inspect—but it has not been independently
        validated to institutional standards.
      </p>
      <div className="stack-list">
        {stack.map(([part, name, description], i) => (
          <article key={part}>
            <span className="stack-number">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <span className="stack-part">{part}</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="directory-note">
        <BookOpen size={20} />
        <p>
          <strong>
            What makes a backtest credible is its assumptions and evidence.
          </strong>{' '}
          Here, missing publication timestamps, incomplete coverage and
          future-dependent data exclusions still limit the conclusions. The
          README explains those boundaries and how to reproduce an experiment.
        </p>
      </div>
      <a
        className="filing-link"
        href="https://github.com/talal-nabulsi/disclosure-lab#methodology"
        target="_blank"
        rel="noreferrer"
      >
        Read the methodology and source code ↗
      </a>
    </section>
  );
}
