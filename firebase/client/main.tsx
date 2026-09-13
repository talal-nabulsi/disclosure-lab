import { createRoot } from 'react-dom/client';
import DisclosureLab from '@/components/disclosure-lab';
import '@fontsource-variable/manrope';
import '@fontsource/dm-mono/400.css';
import '../../app/globals.css';
import './fonts.css';

createRoot(document.getElementById('root')!).render(<DisclosureLab />);
