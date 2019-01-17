import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { Prism } from "../../Prism";
import * as types from "../../typings";
import * as utils from "../../utils";

export abstract class Emitter<O extends string, E extends string, Context extends types.Context<O, E>>
    implements types.EmitArgs<O, E> {
    public prism: Prism<O, E>;
    public introspections: Record<O, introspector.Introspection<O>>;
    protected emit = {} as Record<O, types.Emit<O, E>>;

    constructor(public emission: E, args: types.EmitArgs<O, E>) {
        this.prism = args.prism;
        this.introspections = args.introspections;
    }

    public create(requestedFromEmission = this.emission) {
        _.forEach(this.introspections, (i) => this.emitIntrospection(i, requestedFromEmission));
        return this.emit;
    }

    protected hasUnknownSources() {
        const result = _.some(this.introspections, (i) => i.origin === this.prism.config.unknown.origin);
        return result;
    }

    protected addSpace(lines: string[]) {
        const lastChar = _.last(lines);

        if (lastChar !== "") {
            lines.push("");
        }
    }

    protected emitIntrospection(introspection: introspector.Introspection<O>, requestedFromEmission: E) {
        const context = this.createContext(introspection, requestedFromEmission);

        this.fillIntrospection(context.emit.lines, context);
        this.fillHeadlines(context.emit.headlines, context);
    }

    protected fillHeadlines(headlines: string[], context: types.Context<O, E>) {
        this.fillImports(headlines, context);
    }

    protected fillImports(headlines: string[], context: types.Context<O, E>) {
        const imports: string[] = [];
        const emitFolder = this.prism.getFilePath(context.emit, false);
        const connections = _.uniqWith(context.emit.connections, _.isEqual);

        _.forEach(connections, (c) => {
            const name = this.prism.getEmissionName(c);
            const importFolder = this.prism.getFilePath(c, false);
            const file = utils.getRelativePath(emitFolder, importFolder);
            const isNotThisFile = !!file;

            if (isNotThisFile) {
                const line = `import * as ${name} from '${file}';`;

                if (!_.includes(imports, line)) {
                    imports.push(line);
                }
            }
        });

        this.mergeLines(headlines, imports);
    }

    protected createContext(introspection: introspector.Introspection<O>, requestedFromEmission: E) {
        const requestedFrom: types.Connection<O, E> = {
            origin: introspection.origin,
            emission: requestedFromEmission,
        };

        const emit = this.prism.getEmit(this.emit, requestedFrom);

        return { emit, requestedFrom, introspection } as Context;
    }

    protected mergeLines(dest: string[], source: string[]) {
        source.forEach((v) => dest.push(v));
    }

    protected abstract fillIntrospection(lines: string[], context: Context): void;
}
