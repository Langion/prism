import * as fs from "fs";
import * as _ from "lodash";
import * as mkdirp from "mkdirp";
import * as path from "path";
import * as prettier from "prettier";
import { Configuration, Linter } from "tslint";
import { Emitter } from "./core/Emitter";
import { Type } from "./core/Type";
import * as types from "./typings";

export class Prism<O extends string, E extends string> {
    public static emit<O extends string, E extends string>(config: types.PrismConfig<O, E>) {
        const introemitter = new Prism(config);
        const result = introemitter.emit();
        return result;
    }

    public type: Type<O, E> = new Type<O, E>(this);
    private files: Record<string, string[]> = {};
    private emitters: Array<Emitter<O, E, types.Context<O, E>>> = [];

    private constructor(public config: types.PrismConfig<O, E>) {}

    public async emit() {
        this.sort();

        this.config.emitters.forEach((e) => this.addEmit(e));
        this.emitters.forEach((e) => this.createEmit(e));

        return await this.emitFiles();
    }

    public getEmit(emit: Record<O, types.Emit<O, E>>, connection: types.Connection<O, E>) {
        if (!emit[connection.origin]) {
            emit[connection.origin] = {
                connections: [],
                lines: [],
                headlines: [],
                origin: connection.origin,
                emission: connection.emission,
            };
        }

        return emit[connection.origin];
    }

    public getOriginName(origin: O) {
        let name = _.upperFirst(origin);

        if (origin === this.config.unknown.origin) {
            name = this.config.unknown.name;
        } else if (origin === this.config.shared.origin) {
            name = this.config.shared.name;
        }

        const result = _.upperFirst(name);
        return result;
    }

    public getEmissionName(connection: types.Connection<O, E>) {
        const origin = this.getOriginName(connection.origin);
        const emission = _.upperFirst(connection.emission);
        const name = `${origin}${emission}`;
        return name;
    }

    public getEmitter: <T extends Emitter<O, E, types.Context<O, E>>>(kind: typeof Emitter) => T = (kind) => {
        const emitter = _.find(this.emitters, (e) => e instanceof kind);

        if (emitter) {
            return emitter as any;
        } else {
            throw new Error(`Emitter ${kind.name} is not found`);
        }
    }

    public getFilePath(connection: types.Connection<O, E>, withExtension: boolean) {
        const folder = connection.emission.toLowerCase();
        const base = this.config.outFolderAbsolutePath;
        const name = this.getOriginName(connection.origin);
        const file = withExtension ? `${name}.ts` : name;
        const result = path.join(base, folder, file);
        return result;
    }

    /**
     * Enumerations should got last
     */
    private sort() {
        _.forEach(
            this.config.introspections,
            (i) => (i.sources = _.sortBy(i.sources, (s) => s.shape.kind === "Enumeration")),
        );
    }

    private addEmit(createEmitter: (args: types.EmitArgs<O, E>) => Emitter<O, E, types.Context<O, E>>) {
        const args: types.EmitArgs<O, E> = { introspections: this.config.introspections, prism: this };
        const emitter = createEmitter(args);
        this.emitters.push(emitter);
    }

    private createEmit(emitter: Emitter<O, E, types.Context<O, E>>) {
        const emit = emitter.create();
        this.addToFiles(emit);
    }

    private addToFiles(emit: Record<O, types.Emit<O, E>>) {
        _.forEach(emit, (e) => {
            if (!e.lines.length) {
                return;
            }

            const file = this.getFilePath(e, true);
            const page = e.headlines.concat(e.lines);
            this.files[file] = page;
        });
    }

    private async emitFiles() {
        for (const file in this.files) {
            if (file in this.files) {
                const content = this.files[file];
                await this.write(content, file);
            }
        }
    }

    private async write(page: string[], file: string) {
        const folder = path.parse(file).dir;
        await new Promise((resolve, reject) => mkdirp(folder, (err) => (err ? reject(err) : resolve())));

        let content = page.join("\n");

        const options: prettier.Options = {
            printWidth: 120,
            parser: "typescript",
            ...this.config.prettier,
        };

        try {
            content = prettier.format(content, options);
        } catch (e) {
            // tslint:disable-next-line:no-console
            console.error(`Error in prettier: ${e} in file ${file}`);
        }

        await this.writeContent(file, content);

        if (this.config.tslint.enabled) {
            const linter = new Linter({ fix: true });
            const configuration = Configuration.loadConfigurationFromPath(this.config.tslint.tslintConfigAbsolutePath);
            linter.lint(file, content, configuration);
            const result = linter.getResult();
            content = result.output;
        }

        if (this.config.tslint.addTsIgnore) {
            const lines = ["/* tslint:disable */\n"];
            lines.push("\n");
            let fileContent = fs.readFileSync(file).toString();
            lines.push(fileContent);
            fileContent = lines.join("");
            await this.writeContent(file, fileContent);
        }
    }

    private async writeContent(file: string, content: string) {
        await new Promise((resolve, reject) => fs.writeFile(file, content, (err) => (err ? reject(err) : resolve())));
    }
}
