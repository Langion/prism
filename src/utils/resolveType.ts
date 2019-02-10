import * as graphql from "graphql";

export function resolveType<TSource, TContext>(
    value: TSource,
    {  }: TContext,
    info: graphql.GraphQLResolveInfo,
    types: graphql.GraphQLObjectType[],
) {
    let path: string[] = [];

    const updatePath = (part = info.path) => {
        path.push(part.key.toString());

        if (part.prev) {
            updatePath(part.prev);
        }
    };

    updatePath();
    path = path.reverse();

    const set = path.reduce(
        (a: graphql.SelectionSetNode, c: string) => {
            const node = a.selections.filter((s) => "name" in s && s.name.value === c);
            const result = node.pop()!;

            if ("selectionSet" in result) {
                return result.selectionSet!;
            } else {
                return a;
            }
        },

        info.operation.selectionSet,
    );

    let type = types[0];

    set.selections.forEach((s) => {
        if ("typeCondition" in s) {
            const names = s.selectionSet.selections
                .map((sel) => ("name" in sel ? sel.name.value : ""))
                .filter((sel) => !!sel && sel !== "__typename");

            const hasField = names.some((n) => !!(value as any)[n]);

            if (hasField) {
                const result = types.find((t) => t.name === s.typeCondition!.name.value);

                if (result) {
                    type = result;
                }
            }
        }
    });

    return type;
}
