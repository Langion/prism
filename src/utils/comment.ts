import * as introspector from "@langion/introspector";

export function hasComment(shape: introspector.Shape) {
    return !!shape.comment;
}

export function fillMultilineComment(lines: string[], shape: introspector.Shape) {
    if (!hasComment(shape)) {
        return false;
    }

    lines.push("/**");

    const wraped = wrap(shape.comment);
    wraped.forEach((l) => lines.push(`* ${l.trim()}`));

    lines.push("*/");

    return true;
}

function wrap(comment: string) {
    const maxLength = 80;
    const words = comment.split(" ");

    const withLineBreaks = words.reduce(
        (r, w) => {
            if (r.count > maxLength) {
                return { count: 0, line: `${r.line}\n${w}` };
            } else {
                return { count: r.count + w.length, line: `${r.line} ${w}` };
            }
        },
        {
            count: 0,
            line: "",
        },
    );

    const lines = withLineBreaks.line.split("\n");
    return lines;
}
