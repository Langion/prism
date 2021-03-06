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
    private enumNamesByOrigin = {} as Record<string, Record<string, number>>;

    protected fillIntrospection(lines: string[], context: types.Context<O, E>) {
        _.forEach(context.introspection.sources, (s) => this.fillSource(lines, s, context));
    }

    private fillSource(lines: string[], source: introspector.Source<O>, context: types.Context<O, E>) {
        if (source.shape.kind === "Enumeration") {
            this.fillEnumeration(lines, source.shape, context);
        } else {
            this.fillInterface(lines, source.shape, context);
        }
    }

    private fillEnumeration(lines: string[], enumeration: introspector.Enumeration, context: types.Context<O, E>) {
        if (!this.enumNamesByOrigin[context.emit.origin]) {
            this.enumNamesByOrigin[context.emit.origin] = {};
        }

        const enumNames = this.enumNamesByOrigin[context.emit.origin];

        this.addSpace(lines);
        utils.fillMultilineComment(lines, enumeration);

        let asTypeName = enumeration.name;
        let asEnumName = `${enumeration.name}Enum`;

        if (enumNames[asTypeName] === undefined) {
            enumNames[asTypeName] = 1;
        } else {
            enumNames[asTypeName]++;
            asTypeName = `${asTypeName}_${enumNames[asTypeName]}`;
        }

        if (enumNames[asEnumName] === undefined) {
            enumNames[asEnumName] = 1;
        } else {
            enumNames[asEnumName]++;
            asEnumName = `${asEnumName}_${enumNames[asEnumName]}`;
        }

        lines.push(`export enum ${asEnumName} {`);
        _.forEach(enumeration.values, (v) => lines.push(`${v.key} = "${this.escapeString(v.value)}",`));
        lines.push(`}`);

        this.addSpace(lines);

        const enumValues = _.map(enumeration.values, (v) => `"${this.escapeString(v.value)}"`);
        const enumType = enumValues.length ? enumValues.join("|") : "string";
        lines.push(`export type ${asTypeName} = ${enumType};`);

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

        const result = field.isRequired ? `"${field.name}":${type}` : `"${field.name}"?:${type}`;
        lines.push(result);

        if (hasComment) {
            this.addSpace(lines);
        }
    }

    private escapeString(str: string) {
        const result = str
            .replace(/\\/g, "\\\\")
            .replace(/\$/g, "\\$")
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');

        return result;
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
