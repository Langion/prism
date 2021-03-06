import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import { ApiraApi } from ".";
import { Emitter } from "../core/Emitter";
import * as types from "../typings";
import { GraphqlDefinition } from "./GraphqlDefinition";

export interface ControllersList<O extends string> {
    name: string;
    origin: O;
}

export interface GraphqlAggregatorProps {
    resolveTypePath: string;
}

export class GraphqlAggregator<
    O extends string,
    E extends string,
    Context extends types.Context<O, E> = types.Context<O, E>
> extends Emitter<O, E, Context> {
    protected queryControllers: Array<ControllersList<O>> = [];
    protected mutationControllers: Array<ControllersList<O>> = [];

    private names = this.getGqlNames();

    constructor(emission: E, args: types.EmitArgs<O, E>, public props: GraphqlAggregatorProps) {
        super(emission, args);
    }

    public create() {
        const result = super.create();

        this.createGqlControllers(this.queryControllers, true);
        this.createGqlControllers(this.mutationControllers, false);

        return result;
    }

    public getNameForGql(
        name: string,
        isDuplicate: boolean,
        origin: O,
        gqlPostfix = "",
        variablesNames: string[] = [],
    ) {
        const graphql = this.prism.getEmitter<GraphqlAggregator<O, E, Context>>(GraphqlAggregator);
        let result = name;
        const isNameUsed = _.includes(graphql.names, result);

        if (isNameUsed || isDuplicate) {
            const originName = this.prism.getOriginName(origin);
            const newName = `${result}${originName}${gqlPostfix}`;

            if (_.includes(graphql.names, newName)) {
                result = this.getNameForGql(newName, isDuplicate, origin, gqlPostfix, variablesNames);
            } else {
                result = newName;
            }
        }

        result = variablesNames.length ? `${result}_${variablesNames.join("_")}` : result;
        result = result.replace(/[\[\]]/g, "");

        graphql.names.push(result);
        return result;
    }

    protected fillHeadlines(headlines: string[], context: types.Context<O, E>) {
        context.emit.connections.push({ import: "{resolveType}", path: this.props.resolveTypePath });
        super.fillHeadlines(headlines, context);
        headlines.push(`import * as graphql from 'graphql'`);
    }

    protected fillIntrospection(lines: string[], context: types.Context<O, E>): void {
        this.prism.getEmit(this.emit, context.requestedFrom);

        _.forEach(context.introspection.controllers, (c) => {
            this.createQueryController(lines, c, context);
            this.createMutationController(lines, c, context);
        });
    }

    private getGqlNames() {
        const names: string[] = [];

        _.forEach(this.introspections, (i) => {
            names.push(i.origin);

            _.forEach(i.controllers, (c) => {
                names.push(this.getQueryControllerName(c));
                names.push(this.getMutationControllerName(c));
            });
        });

        return names;
    }

    private createGqlControllers(controllers: Array<ControllersList<O>>, isQuery: boolean) {
        const origin = isQuery ? ("query" as O) : ("mutation" as O);
        const requestedFrom: types.Connection<O, E> = { origin, emission: this.emission };

        this.prism.getEmit(this.emit, requestedFrom);
        const emit = this.emit[requestedFrom.origin];
        const name = isQuery ? "Query" : "Mutation";

        const lines: string[] = [];

        this.addSpace(lines);
        lines.push(`export class ${name} {`);
        lines.push("public create() {");
        lines.push("return {");

        const byService = _.groupBy(controllers, (c: introspector.Controller<O>) => c.origin);

        _.forEach(byService, ({}, i) => {
            const service = isQuery ? i : `${i}${name}`;
            const serviceName = _.upperFirst(service);
            lines.push(`${serviceName}: {type: new graphql.GraphQLObjectType({`);
            lines.push(`name: '${serviceName}',`);
            lines.push(`fields: {`);

            controllers
                .filter((c) => c.origin === i)
                .forEach((c) => {
                    const type = this.prism.type.get({
                        kind: "TypeScript",
                        emit: this.emit,
                        requestedFrom: { origin, emission: this.emission },
                        typeLocation: { origin: c.origin, emission: this.emission },
                        type: {
                            comment: "",
                            generics: [],
                            kind: introspector.TypeKind.Entity,
                            name: c.name,
                            origin: c.origin,
                            isDuplicate: false,
                        },
                    });

                    lines.push(`${c.name}: {type: ${type}, resolve: () => ({})},`);
                });

            lines.push("}");
            lines.push("}),");
            lines.push("resolve: () => ({})},");
        });

        lines.push("}");
        lines.push("}");
        lines.push("}");

        this.addSpace(lines);

        this.fillHeadlines(emit.headlines, {
            emit,
            introspection: {
                controllers: [],
                origin: requestedFrom.origin,
                addedFrom: requestedFrom.origin,
                sources: [],
            },
            requestedFrom,
        });

        this.mergeLines(emit.lines, lines);
    }

    private createQueryController(
        lines: string[],
        controller: introspector.Controller<O>,
        context: types.Context<O, E>,
    ) {
        const methods = _.filter(controller.methods, (m) => m.request === "get");

        if (!methods.length) {
            return "";
        }

        const name = this.getQueryControllerName(controller);
        this.queryControllers.push({ name, origin: context.introspection.origin });

        const result = this.createController(lines, name, controller, methods, context.requestedFrom, context);
        return result;
    }

    private createMutationController(
        lines: string[],
        controller: introspector.Controller<O>,
        context: types.Context<O, E>,
    ) {
        const methods = _.filter(controller.methods, (m) => m.request !== "get");

        if (!methods.length) {
            return "";
        }

        const name = this.getMutationControllerName(controller);
        this.mutationControllers.push({ name, origin: context.introspection.origin });

        const result = this.createController(lines, name, controller, methods, context.requestedFrom, context);
        return result;
    }

    private getQueryControllerName(controller: introspector.Controller<O>) {
        return controller.name;
    }

    private getMutationControllerName(controller: introspector.Controller<O>) {
        return `${controller.name}Mutation`;
    }

    private createController(
        lines: string[],
        name: string,
        controller: introspector.Controller<O>,
        methods: Array<introspector.Method<O>>,
        requestedFrom: types.Connection<O, E>,
        context: types.Context<O, E>,
    ) {
        const interplayName = this.getInterplayName(name);

        this.addSpace(lines);
        lines.push(`export namespace ${interplayName} {`);
        this.addSpace(lines);

        const introspection: introspector.Introspection<O> = {
            controllers: [],
            origin: requestedFrom.origin,
            addedFrom: controller.addedFrom,
            sources: controller.interplay,
        };

        const introspections = {} as Record<O, introspector.Introspection<O>>;
        introspections[requestedFrom.origin] = introspection;

        const emitter = this.prism.getEmitter(GraphqlDefinition) as GraphqlDefinition<O, E, types.Context<O, E>>;

        const definitions = new GraphqlDefinition<O, E>(
            emitter.emission,
            {
                prism: this.prism,
                introspections,
            },
            { rawTypePath: emitter.props.rawTypePath, gqlPostfix: interplayName, nullable: false },
        );

        const models = definitions.create(this.emission);

        _.forEach(models, (e) => {
            this.mergeLines(context.emit.headlines, e.headlines);
            this.mergeLines(lines, e.lines);
        });

        const gqlName = this.getNameForGql(name, false, controller.origin);

        lines.push(`}`);

        this.addSpace(lines);

        lines.push(`export const ${name} = new graphql.GraphQLObjectType({`);
        lines.push(`name:"${gqlName}",`);
        lines.push(`fields: {`);

        _.forEach(methods, (m) => lines.push(this.createMethod(m, requestedFrom, interplayName)));

        lines.push(`}`);

        lines.push(`})`);
        this.addSpace(lines);
    }

    private createMethod(method: introspector.Method<O>, requestedFrom: types.Connection<O, E>, interplayName: string) {
        const returns = _.toArray(method.response);

        let filtered =
            returns.length > 1
                ? returns.filter(
                      (r) =>
                          ![
                              introspector.TypeKind.Object,
                              introspector.TypeKind.Boolean,
                              introspector.TypeKind.List,
                              introspector.TypeKind.Date,
                              introspector.TypeKind.Number,
                              introspector.TypeKind.String,
                              introspector.TypeKind.Void,
                          ].some((t) => t === r.kind),
                  )
                : returns;

        const definitionEmitter = this.prism.getEmitter(GraphqlDefinition);

        if (filtered.length > 1) {
            const withoutScalars: typeof filtered = [];

            filtered.forEach((r) => {
                if (r.kind === introspector.TypeKind.Entity) {
                    withoutScalars.push(r);
                } else {
                    // tslint:disable-next-line:no-console
                    console.log(
                        `Cannot add Scalars to GraphQL response. Controller: "${method.controller.name}", Method: "${
                            method.name
                        }", Response: "${r.name}"`,
                    );
                }
            });

            filtered = withoutScalars;
        }

        const response = filtered.map((r) =>
            this.prism.type.get({
                kind: "GraphQL",
                isInputType: false,
                type: r,
                requestedFrom,
                typeLocation: { origin: requestedFrom.origin, emission: definitionEmitter.emission },
                emit: this.emit,
            }),
        );

        const emitter = this.prism.getEmitter(ApiraApi);

        const resolver = this.prism.type.get({
            kind: "TypeScript",
            type: {
                name: `${method.controller.name}.${method.name === "delete" ? "del" : method.name}`,
                comment: "",
                generics: [],
                kind: introspector.TypeKind.Entity,
                origin: requestedFrom.origin,
                isDuplicate: false,
            },
            requestedFrom,
            emit: this.emit,
            typeLocation: { origin: requestedFrom.origin, emission: emitter.emission },
        });

        let type = "Raw";

        if (response.length === 1) {
            type = response[0];
        } else if (response.length > 1) {
            const name = this.getNameForGql(
                `${method.name}${method.controller.name}Response`,
                false,
                method.controller.origin,
            );

            type = `
            (function() {
                const types = [${response.join()}];

                return new graphql.GraphQLUnionType({
                    name: '${name}',
                    resolveType: (v, c, i) => resolveType(v, c, i, types),
                    types
                });
            })()
            `;

            /*   type = `
            (function() {
                const types = [${response.join()}];

                return new graphql.GraphQLUnionType({
                    name: '${name}',
                    resolveType: (v, {}, i) => {
                        let path: string[] = [];

                        const updatePath = (part = i.path) => {
                            path.push(part.key.toString());

                            if (part.prev) {
                                updatePath(part.prev);
                            }
                        };

                        updatePath();
                        path = path.reverse();

                        const set = path.reduce(
                            (a: graphql.SelectionSetNode, c: string) => {
                                const node = a.selections.filter(s => 'name' in s && s.name.value == c);
                                const result = node.pop()!;

                                if ('selectionSet' in result) {
                                    return result.selectionSet!;
                                } else {
                                    return a;
                                }
                            },

                            i.operation.selectionSet
                        );

                        let type = types[0];

                        set.selections.forEach(s => {
                            if ('typeCondition' in s) {
                                const names = s.selectionSet.selections
                                    .map(sel => ('name' in sel ? sel.name.value : ''))
                                    .filter(sel => !!sel && sel !== '__typename');

                                const hasField = names.some(n => !!v[n]);

                                if (hasField) {
                                    const result = types.find(t => t.name === s.typeCondition!.name.value);

                                    if (result) {
                                        type = result;
                                    }
                                }
                            }
                        });

                        return type;
                    },
                    types
                });
            })()
            `; */
        }

        const args = this.getArgs(method, requestedFrom, interplayName);
        const field = this.createField(method, type, args, resolver);

        return field;
    }

    private createField(method: introspector.Method<O>, type: string, args: string, resolver: string) {
        const lines: string[] = [];
        const path = method.path.replace(/\$/g, "\\$");

        lines.push(`${method.name}: {`);
        lines.push(`description: \`Path: ${path}\\n${method.comment}\`,`);
        lines.push(`type: ${type}, `);
        lines.push(`args: ${args},`);
        lines.push("resolve: (source: any, args: any, c: any, info: any) =>");
        lines.push(`${resolver} (args, {source, info, origin: '${method.controller.origin}', ...c})`);
        lines.push("},");

        const result = lines.join("");
        return result;
    }

    private getArgs(method: introspector.Method<O>, requestedFrom: types.Connection<O, E>, interplayName: string) {
        const lines: string[] = ["{"];

        if (method.query.kind === introspector.TypeKind.Entity) {
            const query = this.prism.type.get({
                kind: "GraphQL",
                isInputType: true,
                emit: this.emit,
                type: method.query,
                requestedFrom,
                typeLocation: requestedFrom,
            });

            lines.push(`query: {type: ${interplayName}.${query}},`);
        }

        if (method.params.kind === introspector.TypeKind.Entity) {
            const params = this.prism.type.get({
                kind: "GraphQL",
                isInputType: true,
                type: method.params,
                requestedFrom,
                typeLocation: requestedFrom,
                emit: this.emit,
            });

            lines.push(`params: {type: new graphql.GraphQLNonNull(${interplayName}.${params})},`);
        }

        const emitter = this.prism.getEmitter(GraphqlDefinition);

        const payload = _.map(method.payload, (p) =>
            this.prism.type.get({
                kind: "GraphQL",
                isInputType: true,
                emit: this.emit,
                type: p,
                requestedFrom,
                typeLocation: {
                    origin: requestedFrom.origin,
                    emission: emitter.emission,
                },
            }),
        );

        if (payload.length === 1) {
            lines.push(`payload: {type: new graphql.GraphQLNonNull(${payload[0]})},`);
        } else if (payload.length > 1) {
            lines.push(`payload: {type: new graphql.GraphQLNonNull(${payload[1]})},`);
        }

        lines.push("}");
        return lines.join("\n");
    }

    private getInterplayName(name: string) {
        return `${name}Interplay`;
    }
}
