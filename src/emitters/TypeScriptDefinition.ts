import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { Emitter } from "../core/Emitter";
import * as types from "../typings";
import * as utils from "../utils";

export class TypeScriptDefinition<
    O extends string,
    E extends string,
    Context extends types.Context<O, E> = types.Context<O, E>
> extends Emitter<O, E, Context> {
    protected fillHeadlines(headlines: string[], context: types.Context<O, E>) {
        super.fillHeadlines(headlines, context);
        const source = this.prism.getFilePath(context.requestedFrom, false);

        const isThisShared = context.requestedFrom.origin === this.prism.config.shared.origin;
        const isThisUnknown = context.requestedFrom.origin === this.prism.config.unknown.origin;
        const shouldReExport = !isThisShared && !isThisUnknown;

        if (shouldReExport && this.hasSharedSources()) {
            this.addSpace(headlines);

            const connection: types.Connection<O, E> = {
                emission: this.emission,
                origin: this.prism.config.shared.origin,
            };

            const sharePath = this.prism.getFilePath(connection, false);
            const relativeSharePath = utils.getRelativePath(source, sharePath);
            headlines.push(`export * from '${relativeSharePath}'`);
        }

        if (shouldReExport && this.hasUnknownSources()) {
            this.addSpace(headlines);

            const connection: types.Connection<O, E> = {
                emission: this.emission,
                origin: this.prism.config.unknown.origin,
            };

            const unknownPath = this.prism.getFilePath(connection, false);
            const relativeUnknownPath = utils.getRelativePath(source, unknownPath);
            headlines.push(`export * from '${relativeUnknownPath}'`);
        }
    }

    protected fillIntrospection(lines: string[], context: types.Context<O, E>) {
        _.forEach(context.introspection.sources, (s) => this.fillSource(lines, s, context));
    }

    private fillSource(lines: string[], source: introspector.Source<O>, context: types.Context<O, E>) {
        if (source.shape.kind === "Enumeration") {
            this.fillEnumeration(lines, source.shape);
        } else {
            this.fillInterface(lines, source.shape, context);
        }
    }

    private fillEnumeration(lines: string[], enumeration: introspector.Enumeration) {
        this.addSpace(lines);
        utils.fillMultilineComment(lines, enumeration);

        lines.push(`export const enum ${enumeration.name}Enum {`);
        _.forEach(enumeration.values, (v, k) => lines.push(`${k} = "${v}",`));
        lines.push(`}`);

        this.addSpace(lines);
        const enumValues = _.map(enumeration.values, (v) => `"${v}"`).join("|");
        lines.push(`export type ${enumeration.name} = ${enumValues};`);

        this.addSpace(lines);
    }

    private fillInterface(lines: string[], interfaze: introspector.Interface<O>, context: types.Context<O, E>) {
        this.addSpace(lines);
        utils.fillMultilineComment(lines, interfaze);

        const name = this.getName(interfaze, context.requestedFrom);
        lines.push(name);

        _.forEach(interfaze.fields, (f) => this.fillField(lines, f, context.requestedFrom));

        lines.push(`}`);
        this.addSpace(lines);
    }

    private fillField(lines: string[], field: introspector.Field<O>, requestedFrom: types.Connection<O, E>) {
        const type = this.prism.type.get({
            kind: "TypeScript",
            type: field.type,
            requestedFrom,
            typeLocation: {
                emission: this.emission,
                origin: field.type.origin,
            },
            emit: this.emit,
        });

        const hasComment = utils.hasComment(field);

        if (hasComment) {
            this.addSpace(lines);
        }

        utils.fillMultilineComment(lines, field);

        const result = `"${field.name}":${type}`;
        lines.push(result);

        if (hasComment) {
            this.addSpace(lines);
        }
    }

    private getName(interfaze: introspector.Interface<O>, requestedFrom: types.Connection<O, E>) {
        const name = ["export", "interface", interfaze.name];

        if (!_.isEmpty(interfaze.variables)) {
            name.push("<");
            const typeVariables = _.map(interfaze.variables, (v) => `${v}=void`).join();
            name.push(typeVariables);
            name.push(">");
        }

        if (!_.isEmpty(interfaze.extends)) {
            name.push("extends");

            const parents = _.map(interfaze.extends, (e) =>
                this.prism.type.get({
                    kind: "TypeScript",
                    type: e,
                    requestedFrom,
                    typeLocation: {
                        emission: this.emission,
                        origin: e.origin,
                    },
                    emit: this.emit,
                }),
            );

            name.push(parents.join());
        }

        name.push("{");

        const result = name.join(" ");
        return result;
    }
}
