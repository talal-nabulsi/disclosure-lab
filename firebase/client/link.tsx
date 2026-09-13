import type { ComponentProps } from 'react';

// The shared screen only uses Next Link for its '/' home anchor.
export default function Link(props: ComponentProps<'a'>) {
  return <a {...props} />;
}
