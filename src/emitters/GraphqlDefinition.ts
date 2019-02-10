import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { Emitter } from "../core/Emitter";
import * as types from "../typings";
import { GraphqlAggregator } from "./";

export interface GraphqlDefinitionProps {
    rawTypePath: string;
    gqlPostfix?: string;
    nullable?: boolean;
}

export class GraphqlDefinition<
    O extends string,
    E extends string,
    Context extends types.Context<O, E> = types.Context<O, E>
> extends Emitter<O, E, Context> {
    constructor(emission: E, args: types.EmitArgs<O, E>, public props: GraphqlDefinitionProps) {
        super(emission, args);

        if (props.gqlPostfix === undefined) {
            props.gqlPostfix = "";
        }

        if (props.nullable === undefined) {
            props.nullable = true;
        }
    }

    protected fillHeadlines(headlines: string[], context: types.Context<O, E>) {
        context.emit.connections.push({ import: "{Raw}", path: this.props.rawTypePath });
        super.fillHeadlines(headlines, context);
        headlines.push(`import * as graphql from 'graphql'`);
    }

    protected fillIntrospection(lines: string[], context: types.Context<O, E>): void {
        this.addSpace(lines);
        _.forEach(context.introspection.sources, (s) => this.fillSource(lines, s, context));
    }

    private fillSource(lines: string[], source: introspector.Source<O>, context: types.Context<O, E>) {
        if (source.shape.kind === "Enumeration") {
            this.fillEnumeration(lines, source.shape, source.origin);
        } else {
            this.fillInterface(lines, source.shape, source.origin, context);
        }
    }

    private fillEnumeration(lines: string[], enumeration: introspector.Enumeration, origin: O) {
        const emitter = this.prism.getEmitter<GraphqlAggregator<O, E, Context>>(GraphqlAggregator);
        const name = emitter.getNameForGql(enumeration.name, enumeration.isDuplicate, origin, this.props.gqlPostfix);

        lines.push(`export const ${enumeration.name} = new graphql.GraphQLEnumType({`);
        lines.push(`name: '${name}',`);
        lines.push(`values: {`);

        if (_.isEmpty(enumeration.values)) {
            lines.push(`'empty': {value: 'empty'},`);
        } else {
            _.forEach(enumeration.values, (v) => lines.push(`'${v.key}': {value: \`${v.value}\`},`));
        }

        lines.push(`}`);
        lines.push(`})`);
        this.addSpace(lines);
    }

    private fillInterface(
        lines: string[],
        interfaze: introspector.Interface<O>,
        origin: O,
        context: types.Context<O, E>,
    ) {
        const fillFields = () => {
            _.forEach(interfaze.extends, (e) => this.fillExtends(lines, e, context.requestedFrom));
            _.forEach(interfaze.fields, (f) => this.fillField(lines, f, context.requestedFrom));
        };

        const hasFields = !_.isEmpty(interfaze.fields) || !_.isEmpty(interfaze.extends);

        this.fillDefinition(
            lines,
            interfaze.name,
            fillFields,
            hasFields,
            interfaze.isDuplicate,
            origin,
            interfaze.comment,
            interfaze.variables,
        );

        this.addSpace(lines);
    }

    private fillExtends(lines: string[], parent: introspector.Type<O>, requestedFrom: types.Connection<O, E>) {
        const type = this.prism.type.get({
            kind: "GraphQL",
            type: parent,
            typeLocation: {
                origin: parent.origin,
                emission: this.emission,
            },
            requestedFrom,
            emit: this.emit,
        });

        lines.push("...(function() {");
        lines.push(`const fields = ${type}.getFields();`);
        lines.push(`const result: any = {};`);
        lines.push(
            "Object.keys(fields).forEach((k)=>result[k] = {type: fields[k].type, description: fields[k].description});",
        );
        lines.push("return result;");
        lines.push("})(),");
    }

    private fillField(lines: string[], field: introspector.Field<O>, requestedFrom: types.Connection<O, E>) {
        let type = this.prism.type.get({
            kind: "GraphQL",
            type: field.type,
            typeLocation: {
                origin: field.type.origin,
                emission: this.emission,
            },
            requestedFrom,
            emit: this.emit,
        });

        if (!this.props.nullable || field.isRequired) {
            type = `new graphql.GraphQLNonNull(${type})`;
        }

        const result = `'${field.name}': {type: ${type}, description: \`${field.comment}\`},`;
        lines.push(result);
    }

    private fillDefinition(
        lines: string[],
        name: string,
        fillFields: () => void,
        hasFields: boolean,
        isDuplicate: boolean,
        origin: O,
        comment: string,
        variables?: string[],
    ) {
        const varTypesSignature = this.getVarTypes(origin, variables, true);
        const varTypes = this.getVarTypes(origin, variables, false);
        const emitter = this.prism.getEmitter<GraphqlAggregator<O, E, Context>>(GraphqlAggregator);

        const variablesNames = _.map(variables, (v) => `\${${v}}`);
        const nameForGql = emitter.getNameForGql(name, isDuplicate, origin, this.props.gqlPostfix, variablesNames);

        lines.push(`export const ${name} = (() => {`);
        lines.push(`const cache: Record<string, graphql.GraphQLObjectType | graphql.GraphQLInputObjectType> = {};`);
        lines.push(``);
        lines.push(`function ${name}(isInput: true,  ${varTypesSignature.join()}): graphql.GraphQLInputObjectType;`);
        lines.push(`function ${name}(isInput: false,  ${varTypesSignature.join()}): graphql.GraphQLObjectType;`);
        lines.push(`function ${name}(isInput: any,  ${varTypes.join()}) {`);
        lines.push(`let name =  isInput`);
        lines.push(`? \`${nameForGql}Input\``);
        lines.push(`: \`${nameForGql}\`;`);
        lines.push(``);
        lines.push(`name = name.replace(/[\\[\\]]/g, '')`);
        lines.push(``);
        lines.push(`if (!cache[name]) {`);
        lines.push(`const c = {`);
        lines.push(`name,`);
        lines.push(`description: \`${comment}\`,`);
        lines.push(`interfaces: [],`);
        lines.push(`fields: () => ({`);

        lines.push(`raw: {type: Raw},`);

        if (hasFields) {
            fillFields();
        }

        lines.push(`}),`);
        lines.push(`} as graphql.GraphQLObjectTypeConfig<any, any> | graphql.GraphQLInputObjectTypeConfig;`);
        lines.push(``);
        lines.push(`cache[name] = isInput`);
        lines.push(`? new graphql.GraphQLInputObjectType(c as graphql.GraphQLInputObjectTypeConfig)`);
        lines.push(`: new graphql.GraphQLObjectType(c as graphql.GraphQLObjectTypeConfig<any, any>);`);
        lines.push(`}`);
        lines.push(`return cache[name];`);
        lines.push(`};`);

        lines.push(``);

        lines.push(`return ${name}`);
        lines.push(`})();`);
    }

    private getVarTypes({}: O, variables?: string[], isSignature?: boolean) {
        const baseTypes = "graphql.GraphQLOutputType | graphql.GraphQLInputObjectType | undefined";

        const varTypes = _.map(variables, (v) => (isSignature ? `${v}?: ${baseTypes}` : `${v}: ${baseTypes} = Raw`));

        return varTypes;
    }
}
