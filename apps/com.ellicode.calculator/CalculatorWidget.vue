<script setup lang="ts">
import { Check, Copy, CopyCheck } from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps({
    query: {
        type: String,
    },
});
const response = computed(() => {
    try {
        if (!props.query) return "";

        // First check if the query contains invalid characters
        if (
            !/^[\d\s+\-*/.()x^%&|<>=!?:,;\[\]{}piintrqscoea]+$/i.test(
                props.query
            )
        ) {
            return "Error";
        }

        // Safer calculator function that properly handles operation priority
        const calculate = (expression: string): number => {
            // Replace common math terms
            expression = expression
                .replace(/pi/g, String(Math.PI))
                .replace(/e/g, String(Math.E))
                .replace(/x(?![a-zA-Z])/g, "*");

            // Handle functions
            expression = expression
                .replace(/sqrt\(([^)]+)\)/g, (_, inner) => {
                    const value = evaluateExpression(inner);
                    return String(Math.sqrt(value));
                })
                .replace(/sin\(([^)]+)\)/g, (_, inner) => {
                    const value = evaluateExpression(inner);
                    return String(Math.sin(value));
                })
                .replace(/cos\(([^)]+)\)/g, (_, inner) => {
                    const value = evaluateExpression(inner);
                    return String(Math.cos(value));
                })
                .replace(/tan\(([^)]+)\)/g, (_, inner) => {
                    const value = evaluateExpression(inner);
                    return String(Math.tan(value));
                });

            return evaluateExpression(expression);
        };

        // Helper function to evaluate expressions with proper precedence
        const evaluateExpression = (expr: string): number => {
            // Handle parentheses first
            let parenRegex = /\(([^()]+)\)/g;
            let match;

            while ((match = parenRegex.exec(expr)) !== null) {
                const result = evaluateExpression(match[1]);
                expr =
                    expr.substring(0, match.index) +
                    result +
                    expr.substring(match.index + match[0].length);
                parenRegex.lastIndex = 0;
            }

            // Handle exponents
            if (expr.includes("^")) {
                const parts = expr.split("^");
                const base = evaluateExpression(parts[0]);
                const exponent = evaluateExpression(parts[1]);
                return Math.pow(base, exponent);
            }

            // Handle multiplication and division
            if (expr.includes("*") || expr.includes("/")) {
                const terms = expr.split(/([*/])/);
                let result = parseFloat(terms[0]);

                for (let i = 1; i < terms.length; i += 2) {
                    const operator = terms[i];
                    const value = parseFloat(terms[i + 1]);

                    if (operator === "*") result *= value;
                    else if (operator === "/") result /= value;
                }
                return result;
            }

            // Handle addition and subtraction
            if (expr.includes("+") || /[^e]-/.test(expr)) {
                // Split by + or - but not by e- (as in scientific notation)
                const parts = expr.split(/([+])|(?<!e)([-])/g).filter(Boolean);
                let result = parseFloat(parts[0] || "0");
                let expectOperator = true;

                for (let i = 1; i < parts.length; i++) {
                    if (expectOperator) {
                        // This should be an operator
                        expectOperator = false;
                    } else {
                        // This should be a value
                        const value = parseFloat(parts[i]);
                        if (parts[i - 1] === "+") result += value;
                        else if (parts[i - 1] === "-") result -= value;
                        expectOperator = true;
                    }
                }
                return result;
            }

            // Base case: just a number
            return parseFloat(expr) || 0;
        };

        // Parse and calculate
        try {
            const result = calculate(props.query);
            return isNaN(result) ? "Error: Not a number" : result;
        } catch (e) {
            console.error(e);
            return "Error: Invalid calculation";
        }
    } catch (e) {
        return "Error: " + (e as Error).message;
    }
});
const latex = computed(() => {
    // Recursive function to handle nested expressions and build fractions
    const formatLatex = (expr: string): string => {
        // Basic symbols replacement
        let formattedExpr = expr
            .replace(/\*/g, "\\times ")
            .replace(/x(?![a-zA-Z])/g, "\\times ")
            .replace(/pi/g, "\\pi ")
            .replace(/=/g, "");

        // Replace functions
        formattedExpr = formattedExpr
            .replace(
                /sqrt\(([^)]+)\)/g,
                (_, inner) => `\\sqrt{${formatLatex(inner)}}`
            )
            .replace(
                /sin\(([^)]+)\)/g,
                (_, inner) => `\\sin(${formatLatex(inner)})`
            )
            .replace(
                /cos\(([^)]+)\)/g,
                (_, inner) => `\\cos(${formatLatex(inner)})`
            )
            .replace(
                /tan\(([^)]+)\)/g,
                (_, inner) => `\\tan(${formatLatex(inner)})`
            );

        // Handle division with fractions that contain parenthetical expressions first
        const fracParenRegex = /\(([^()]+)\)\/([^\/]+)/g;
        let fracMatch;
        while ((fracMatch = fracParenRegex.exec(formattedExpr)) !== null) {
            const fullMatch = fracMatch[0];
            const numerator = fracMatch[1];
            const denominator = fracMatch[2];
            formattedExpr = formattedExpr.replace(
                fullMatch,
                `\\frac{${formatLatex(numerator)}}{${formatLatex(denominator)}}`
            );
            // Reset regex after replacing
            fracParenRegex.lastIndex = 0;
        }

        // Process nested parentheses
        const parenRegex = /\(([^()]+)\)/g;
        let match;
        let result = formattedExpr;

        // Handle all parenthetical expressions
        while ((match = parenRegex.exec(formattedExpr)) !== null) {
            const fullMatch = match[0];
            const innerContent = match[1];
            const formattedInner = formatLatex(innerContent);

            // Check if this is part of a division that should be a fraction
            const nextChar = formattedExpr.substring(
                match.index + fullMatch.length,
                match.index + fullMatch.length + 1
            );
            const prevChar =
                match.index > 0
                    ? formattedExpr.substring(match.index - 1, match.index)
                    : "";

            if (nextChar === "/" || prevChar === "/") {
                // Don't add parentheses for expressions that will become fractions
                result = result.replace(fullMatch, formattedInner);
            } else {
                result = result.replace(
                    fullMatch,
                    `\\left(${formattedInner}\\right)`
                );
            }
        }

        // If we processed any parentheses, return the result
        if (result !== formattedExpr) return result;

        // Handle powers with ^ syntax
        if (result.includes("^")) {
            // Use a regex to find bases and exponents
            let processed = "";
            let remaining = result;

            // Look for patterns like "base^exponent" where exponent is a single number or term
            const powerRegex =
                /([^\s^+\-*/]+|\([^)]+\))\s*\^\s*([0-9]+|[a-zA-Z]+)/g;
            let lastIndex = 0;
            let powerMatch;

            while ((powerMatch = powerRegex.exec(remaining)) !== null) {
                // Add text before the match
                processed += remaining.substring(lastIndex, powerMatch.index);

                const base = powerMatch[1].trim();
                const exponent = powerMatch[2].trim();

                // Format the base properly
                const formattedBase =
                    base.includes(" ") ||
                    base.includes("+") ||
                    base.includes("-") ||
                    base.includes("\\times") ||
                    base.includes("\\frac")
                        ? `{${base}}`
                        : base;

                processed += `${formattedBase}^{${exponent}}`;
                lastIndex = powerMatch.index + powerMatch[0].length;
            }

            // Add any remaining text
            processed += remaining.substring(lastIndex);

            return processed;
        }

        // Handle division with fractions - process the entire expression at once
        if (formattedExpr.includes("/")) {
            // Check if this is a simple fraction with no other operators
            if (!formattedExpr.match(/[+\-*^]/)) {
                const divParts = formattedExpr.split("/");
                if (divParts.length === 2) {
                    return `\\frac{${formatLatex(divParts[0])}}{${formatLatex(
                        divParts[1]
                    )}}`;
                }

                // Handle multiple divisions like a/b/c as nested fractions
                let frac = formatLatex(divParts[divParts.length - 1]);
                for (let j = divParts.length - 2; j >= 0; j--) {
                    frac = `\\frac{${formatLatex(divParts[j])}}{${frac}}`;
                }
                return frac;
            }

            // Handle more complex expressions with fractions and other operators
            const parts = formattedExpr.split(/([+\-])/);
            let resultExpr = "";

            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === "+" || parts[i] === "-") {
                    resultExpr += parts[i];
                } else if (parts[i].includes("/")) {
                    // Process divisions within this term
                    const divParts = parts[i].split("/");
                    if (divParts.length === 2) {
                        resultExpr += `\\frac{${formatLatex(
                            divParts[0]
                        )}}{${formatLatex(divParts[1])}}`;
                    } else {
                        // Handle multiple divisions like a/b/c as nested fractions
                        let frac = formatLatex(divParts[divParts.length - 1]);
                        for (let j = divParts.length - 2; j >= 0; j--) {
                            frac = `\\frac{${formatLatex(
                                divParts[j]
                            )}}{${frac}}`;
                        }
                        resultExpr += frac;
                    }
                } else {
                    resultExpr += parts[i];
                }
            }
            return resultExpr;
        }

        return formattedExpr;
    };

    const serializedLatex = props.query ? formatLatex(props.query) : "";

    // Check if the result is likely an irrational number
    const isIrrational =
        typeof response.value === "number" &&
        !Number.isInteger(response.value) &&
        response.value.toString().includes(".") &&
        response.value.toString().split(".")[1].length > 8;

    const operator = isIrrational ? "\\approx" : "=";

    return serializedLatex + ` ${operator} ${response.value}`;
});

const copied = ref(false);

const copyToClipboard = () => {
    navigator.clipboard.writeText(response.value.toString()).then(() => {
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 2000);
    });
};
</script>

<template>
    <div class="flex items-center justify-center gap-5">
        <vue-latex
            class="select-text"
            style="font-size: 1.1rem"
            :expression="latex"
            display-mode
        />
        <button
            @click="copyToClipboard"
            class="text-neutral-500 outline-0 hover:text-neutral-100 transition-colors cursor-pointer"
        >
            <Check v-if="copied" class="w-5 h-5" />
            <Copy v-else class="w-5 h-5" />
        </button>
    </div>
</template>
