import * as path from "path";

export function getRelativePath(source: string, target: string) {
    if (source === target) {
        return "";
    }

    const sourceWithoutFile = path.dirname(source);
    const targetWithoutFile = path.dirname(target);

    if (sourceWithoutFile === targetWithoutFile) {
        const file = path.basename(target);
        return `./${file}`;
    } else {
        const file = (path as any).relative(source, target);
        const normalized = file.replace(/\\/g, "/").replace("../", "");
        return normalized;
    }
}
