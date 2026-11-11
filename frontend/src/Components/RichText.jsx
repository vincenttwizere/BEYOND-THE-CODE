function RichText({ body = "", className = "" }) {
    const blocks = [];
    const codePattern = /```([a-z0-9_-]*)\n([\s\S]*?)```/gi;
    let cursor = 0;
    for (const match of body.matchAll(codePattern)) {
        addTextBlocks(blocks, body.slice(cursor, match.index), `before-${match.index}`);
        blocks.push(<pre key={`code-${match.index}`}><code className={match[1] ? `language-${match[1]}` : undefined}>{match[2]}</code></pre>);
        cursor = match.index + match[0].length;
    }
    addTextBlocks(blocks, body.slice(cursor), "tail");
    return <div className={className}>{blocks}</div>;
}

function addTextBlocks(blocks, value, key) {
    value.split(/\n{2,}/).filter((text) => text.trim()).forEach((text, index) => {
        const content = text.trim();
        const heading = content.match(/^(#{1,3})\s+(.+)$/);
        const quoted = content.split("\n").every((line) => line.startsWith("> "));
        if (heading) {
            const level = heading[1].length;
            const Heading = `h${level + 1}`;
            blocks.push(<Heading key={`${key}-h-${index}`}>{renderInline(heading[2])}</Heading>);
        } else if (quoted) {
            blocks.push(<blockquote key={`${key}-q-${index}`}>{renderInline(content.split("\n").map((line) => line.slice(2)).join("\n"))}</blockquote>);
        } else {
            blocks.push(<p key={`${key}-p-${index}`}>{renderInline(content)}</p>);
        }
    });
}

function renderInline(text) {
    const tokens = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts = [];
    let cursor = 0;
    for (const match of text.matchAll(tokens)) {
        if (match.index > cursor) parts.push(text.slice(cursor, match.index));
        const token = match[0];
        if (token.startsWith("**")) parts.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
        else if (token.startsWith("`")) parts.push(<code key={`inline-${match.index}`}>{token.slice(1, -1)}</code>);
        else parts.push(<em key={`em-${match.index}`}>{token.slice(1, -1)}</em>);
        cursor = match.index + token.length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
}

export default RichText;
