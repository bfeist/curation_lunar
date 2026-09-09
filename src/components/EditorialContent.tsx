import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** HTML arrives only from the server's allowlisted presentation adapter. */
export function EditorialContent({ html }: { html: string }) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash)
      document
        .getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView();
  }, [html, hash]);
  return (
    <article
      className="editorial"
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (
          anchor?.getAttribute("href")?.startsWith("/") &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.button === 0
        ) {
          event.preventDefault();
          navigate(anchor.getAttribute("href")!);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
