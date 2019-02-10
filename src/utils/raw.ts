import * as graphql from "graphql";

export const Raw = new graphql.GraphQLScalarType({
    name: "Raw",
    description: "Сырое значение как есть",
    serialize: (v: any) => {
        return v;
    },
    parseValue: (v: any) => {
        return v;
    },
    parseLiteral(ast: any) {
        switch (ast.kind) {
            case "BooleanValue":
                return ast.value;
            case "EnumValue":
                return ast.value;
            case "FloatValue":
                return ast.value;
            case "IntValue":
                return ast.value;
            case "ListValue":
                return ast.values;
            case "NullValue":
                return null;
            case "ObjectValue":
                const result = {} as any;

                ast.fields.forEach((f: any) => {
                    const asNumber = parseFloat(f.value.value);
                    result[f.name.value] = isNaN(asNumber) ? f.value.value : asNumber;
                });

                return result;
            case "StringValue":
                return ast.value;
            case "Variable":
                return ast.name;
        }
    },
});
