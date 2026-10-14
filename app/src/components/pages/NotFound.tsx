import { followLink } from '../../router';
import { Page } from './Page';

export function NotFound({ path }: { path: string }) {
  return (
    <Page title="Page not found">
      <p>Nothing lives at <code>{path}</code>. <a href="/" onClick={(e) => followLink(e)}>Go to the front page</a>.</p>
    </Page>
  );
}
