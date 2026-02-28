import React from "react";
import katex from "katex";

interface Props {
    math: string;
    block?: boolean;
}

export default function InlineMath({ math, block = false }: Props) {
    const html = katex.renderToString(math, {
        throwOnError: false,
        displayMode: block,
    });

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
