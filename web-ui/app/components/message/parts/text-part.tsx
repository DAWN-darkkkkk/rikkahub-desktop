import Markdown from "~/components/markdown/markdown";

interface TextPartProps {
  text: string;
  isAnimating?: boolean;
  onClickCitation?: (id: string) => void;
  citationOrdinalMap?: Map<string, number>;
}

export function TextPart({
  text,
  isAnimating,
  onClickCitation,
  citationOrdinalMap,
}: TextPartProps) {
  if (!text) return null;
  return (
    <div data-part="text">
      <Markdown
        content={text}
        className="message-markdown"
        isAnimating={isAnimating}
        onClickCitation={onClickCitation}
        citationOrdinalMap={citationOrdinalMap}
      />
    </div>
  );
}
