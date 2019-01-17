import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import * as path from "path";
import { Emitter } from "../core/Emitter";
import * as types from "../typings";
import * as utils from "../utils";
import { TypeScriptDefinition } from "./TypeScriptDefinition";

export class ApiraApi<
    O extends string,
    E extends string,
    Context extends types.Context<O, E> = types.Context<O, E>
> extends Emitter<O, E, Context> {
    constructor(emission: E, private config: types.ApiraApiArgs<O, E>) {
        super(emission, config);
    }

    protected fillHeadlines(headlines: string[], context: types.Context<O, E>) {
        super.fillHeadlines(headlines, context);
        const emitFolder = this.prism.getFilePath(context.emit, false);
        const parsed = path.parse(this.config.apiAbsolutePath);
        const apiAbsolutePath = path.join(parsed.dir, parsed.name);

        const apiPath = utils.getRelativePath(emitFolder, apiAbsolutePath);
        headlines.push(`import {api} from '${apiPath}'`);
    }

    protected fillIntrospection(lines: string[], context: types.Context<O, E>): void {
        _.forEach(context.introspection.controllers, (c) => this.fillController(lines, c, context));
    }

    private fillController(lines: string[], controller: introspector.Controller<O>, context: types.Context<O, E>) {
        this.addSpace(lines);
        lines.push(`export namespace ${controller.name} {`);

        const introspection: introspector.Introspection<O> = {
            controllers: [],
            origin: context.requestedFrom.origin,
            addedFrom: controller.addedFrom,
            sources: controller.interplay,
        };

        const introspections = {} as Record<O, introspector.Introspection<O>>;
        introspections[context.requestedFrom.origin] = introspection;

        const emitter = this.prism.getEmitter(TypeScriptDefinition);
        const model = new TypeScriptDefinition<O, E>(emitter.emission, {
            prism: this.prism,
            introspections,
        });

        const models = model.create(this.emission);

        _.forEach(models, (e) => {
            this.mergeLines(context.emit.headlines, e.headlines);
            this.mergeLines(lines, e.lines);
        });

        _.forEach(controller.methods, (m) => this.createMethod(lines, m, context.requestedFrom));

        lines.push(`}`);
    }

    private createMethod(lines: string[], method: introspector.Method<O>, requestedFrom: types.Connection<O, E>) {
        const url = this.createPath(method, requestedFrom);
        const emitter = this.prism.getEmitter(TypeScriptDefinition);

        const query = this.prism.type.get({
            kind: "TypeScript",
            emit: this.emit,
            type: method.query,
            requestedFrom,
            typeLocation: requestedFrom,
        });

        const response =
            _.map(method.response, (r) =>
                this.prism.type.get({
                    kind: "TypeScript",
                    emit: this.emit,
                    type: r,
                    requestedFrom,
                    typeLocation: {
                        origin: requestedFrom.origin,
                        emission: emitter.emission,
                    },
                }),
            ).join("|") || "void";

        const payload =
            _.map(method.payload, (p) =>
                this.prism.type.get({
                    kind: "TypeScript",
                    emit: this.emit,
                    type: p,
                    requestedFrom,
                    typeLocation: {
                        origin: requestedFrom.origin,
                        emission: emitter.emission,
                    },
                }),
            ).join("|") || "void";

        const name = method.name === "delete" ? "del" : method.name;

        this.addSpace(lines);
        lines.push(`export const ${name} = api`);
        lines.push(url);
        lines.push(`.request<${response},${query}, ${payload}>('${method.request}')`);
        lines.push(".build()");
        this.addSpace(lines);
    }

    private createPath(method: introspector.Method<O>, requestedFrom: types.Connection<O, E>) {
        const parts = [".path("];

        if (method.params.name !== "void") {
            const param = this.prism.type.get({
                kind: "TypeScript",
                type: method.params,
                requestedFrom,
                typeLocation: requestedFrom,
                emit: this.emit,
            });

            const url = method.path.replace(/{/g, "${p.");
            parts.push(`(p:${param}) => \`${url}\``);
        } else {
            parts.push(`'${method.path}'`);
        }

        parts.push(")");
        return parts.join("");
    }
}
