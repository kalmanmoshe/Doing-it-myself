import { Position } from "./mathEngine";
export function expandExpression(tokens, position) {
    if (position.checkFrac()) {
        goodByFraction(tokens, position);
        return;
    }
    let left = tokens.tokens.slice(position.left.breakChar, position.index).filter(item => /(number|variable|powerVariable)/.test(item.type));
    let right = tokens.tokens.slice(position.index, position.right.breakChar).filter(item => /(number|variable|powerVariable)/.test(item.type));
    const isLeft = position.left.multiStep === undefined;
    if (position.operator === "-" && isLeft) {
        left = [{ "type": "number", "value": -1, "index": 0 }];
    }
    let replacementCell = [];
    for (let i = 0; i < left.length; i++) {
        for (let j = 0; j < right.length; j++) {
            replacementCell.push(left[i]);
            replacementCell.push({ "type": "operator", "value": "*", "index": 0 });
            replacementCell.push(right[j]);
        }
    }
    const is = position.operator === "-" && isLeft;
    const start = is ? position.index : position.left.breakChar;
    const length = position.right.breakChar - (is ? position.index : position.left.breakChar);
    tokens.insertTokens(start, length + (isLeft ? 0 : 1), replacementCell);
    tokens.reIDparentheses();
}
export const curlyBracketsRegex = new RegExp("(frac|sqrt|\\^|\\/|binom)");
function goodByFraction(tokens, position) {
    let replacementTokens = [];
    let denominator = tokens.tokens.slice(position.transition, position.right.breakChar);
    for (let i = 0; i < tokens.tokens.length; i++) {
        // Skip tokens if we have already processed this section
        if (i >= position.index && i < position.right.breakChar) {
            replacementTokens.push(...tokens.tokens.slice(position.index + 1, position.transition));
            i = position.right.breakChar - 1;
            continue;
        }
        if (/(=)/.test(tokens.tokens[i].value)) {
            replacementTokens.push(tokens.tokens[i]);
            continue;
        }
        let replacement = tokens.tokens.slice(i, i + 1);
        let whereAmI = i;
        let rest = [];
        if (tokens.tokens[i].value === "frac") {
            whereAmI = new Position(tokens, i);
            replacementTokens.push(...tokens.tokens.slice(whereAmI.index, whereAmI.index + 2));
            rest = tokens.tokens.slice(whereAmI.transition - 1, whereAmI.right.breakChar);
            replacement = tokens.tokens.slice(i + 2, whereAmI.transition - 1);
        }
        else {
            whereAmI = i + tokens.tokens.slice(i).findIndex(token => /(=|frac)/.test(token.value));
            whereAmI = whereAmI < i ? tokens.tokens.length : whereAmI;
            replacement = tokens.tokens.slice(i, whereAmI);
        }
        replacementTokens.push(...denominator, { "type": "operator", "value": "*" }, { "type": "paren", "value": "(", "id": 0, "index": 0 }, ...replacement, { "type": "paren", "value": ")", "id": 0, "index": 0 }, ...rest);
        i = typeof whereAmI === "object" ? whereAmI.right.breakChar - 1 : whereAmI - 1;
    }
    tokens.tokens = replacementTokens;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1WZXJ5TGF6eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbVZlcnlMYXp5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFFeEMsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxRQUFRO0lBQzdDLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFDO1FBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUFBLE9BQU87S0FBQztJQUNuRSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsaUNBQWlDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzFJLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDNUksTUFBTSxNQUFNLEdBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLEtBQUcsU0FBUyxDQUFDO0lBQ2pELElBQUksUUFBUSxDQUFDLFFBQVEsS0FBRyxHQUFHLElBQUUsTUFBTSxFQUFDO1FBQ2hDLElBQUksR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUE7S0FFekQ7SUFDRCxJQUFJLGVBQWUsR0FB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RSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBQyxFQUNwRCxHQUFHLFdBQVcsRUFDZCxFQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUMsRUFDcEQsR0FBRyxJQUFJLENBQ1YsQ0FBQztRQUNGLENBQUMsR0FBRyxPQUFPLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFDLENBQUMsQ0FBQztLQUM5RTtJQUNELE1BQU0sQ0FBQyxNQUFNLEdBQUMsaUJBQWlCLENBQUM7QUFDcEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSBcIi4vbWF0aEVuZ2luZVwiO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4cGFuZEV4cHJlc3Npb24odG9rZW5zLCBwb3NpdGlvbikge1xyXG4gICAgaWYgKHBvc2l0aW9uLmNoZWNrRnJhYygpKXtnb29kQnlGcmFjdGlvbih0b2tlbnMsIHBvc2l0aW9uKTtyZXR1cm47fVxyXG4gICAgbGV0IGxlZnQgPSB0b2tlbnMudG9rZW5zLnNsaWNlKHBvc2l0aW9uLmxlZnQuYnJlYWtDaGFyLCBwb3NpdGlvbi5pbmRleCkuZmlsdGVyKGl0ZW0gPT4gLyhudW1iZXJ8dmFyaWFibGV8cG93ZXJWYXJpYWJsZSkvLnRlc3QoaXRlbS50eXBlKSk7XHJcbiAgICBsZXQgcmlnaHQgPSB0b2tlbnMudG9rZW5zLnNsaWNlKHBvc2l0aW9uLmluZGV4LCBwb3NpdGlvbi5yaWdodC5icmVha0NoYXIpLmZpbHRlcihpdGVtID0+IC8obnVtYmVyfHZhcmlhYmxlfHBvd2VyVmFyaWFibGUpLy50ZXN0KGl0ZW0udHlwZSkpO1xyXG4gICAgY29uc3QgaXNMZWZ0PXBvc2l0aW9uLmxlZnQubXVsdGlTdGVwPT09dW5kZWZpbmVkO1xyXG4gICAgaWYgKHBvc2l0aW9uLm9wZXJhdG9yPT09XCItXCImJmlzTGVmdCl7XHJcbiAgICAgICAgbGVmdCA9IFt7IFwidHlwZVwiOiBcIm51bWJlclwiLCBcInZhbHVlXCI6IC0xLCBcImluZGV4XCI6IDAgfV1cclxuICAgICAgICBcclxuICAgIH1cclxuICAgIGxldCByZXBsYWNlbWVudENlbGwgPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVmdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcmlnaHQubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgcmVwbGFjZW1lbnRDZWxsLnB1c2gobGVmdFtpXSk7XHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50Q2VsbC5wdXNoKHsgXCJ0eXBlXCI6IFwib3BlcmF0b3JcIiwgXCJ2YWx1ZVwiOiBcIipcIiwgXCJpbmRleFwiOiAwIH0pO1xyXG4gICAgICAgICAgICByZXBsYWNlbWVudENlbGwucHVzaChyaWdodFtqXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlzPXBvc2l0aW9uLm9wZXJhdG9yPT09XCItXCImJmlzTGVmdDtcclxuICAgIGNvbnN0IHN0YXJ0PWlzP3Bvc2l0aW9uLmluZGV4OnBvc2l0aW9uLmxlZnQuYnJlYWtDaGFyXHJcbiAgICBjb25zdCBsZW5ndGg9cG9zaXRpb24ucmlnaHQuYnJlYWtDaGFyLShpcz9wb3NpdGlvbi5pbmRleDpwb3NpdGlvbi5sZWZ0LmJyZWFrQ2hhcilcclxuICAgIHRva2Vucy5pbnNlcnRUb2tlbnMoc3RhcnQsIGxlbmd0aCsoaXNMZWZ0PzA6MSksIHJlcGxhY2VtZW50Q2VsbCk7XHJcbiAgICB0b2tlbnMucmVJRHBhcmVudGhlc2VzKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBjdXJseUJyYWNrZXRzUmVnZXggPSBuZXcgUmVnRXhwKFwiKGZyYWN8c3FydHxcXFxcXnxcXFxcL3xiaW5vbSlcIilcclxuXHJcblxyXG5cclxuZnVuY3Rpb24gZ29vZEJ5RnJhY3Rpb24odG9rZW5zLCBwb3NpdGlvbikge1xyXG4gICAgbGV0IHJlcGxhY2VtZW50VG9rZW5zID0gW107XHJcbiAgICBsZXQgZGVub21pbmF0b3IgPSB0b2tlbnMudG9rZW5zLnNsaWNlKHBvc2l0aW9uLnRyYW5zaXRpb24sIHBvc2l0aW9uLnJpZ2h0LmJyZWFrQ2hhcik7XHJcbiAgICBcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLnRva2Vucy5sZW5ndGg7IGkrKykge1xyXG5cclxuICAgICAgICAvLyBTa2lwIHRva2VucyBpZiB3ZSBoYXZlIGFscmVhZHkgcHJvY2Vzc2VkIHRoaXMgc2VjdGlvblxyXG4gICAgICAgIGlmIChpID49IHBvc2l0aW9uLmluZGV4ICYmIGkgPCBwb3NpdGlvbi5yaWdodC5icmVha0NoYXIpIHtcclxuICAgICAgICAgICAgcmVwbGFjZW1lbnRUb2tlbnMucHVzaCguLi50b2tlbnMudG9rZW5zLnNsaWNlKHBvc2l0aW9uLmluZGV4KzEscG9zaXRpb24udHJhbnNpdGlvbikpXHJcbiAgICAgICAgICAgIGkgPSBwb3NpdGlvbi5yaWdodC5icmVha0NoYXItMTtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICgvKD0pLy50ZXN0KHRva2Vucy50b2tlbnNbaV0udmFsdWUpKSB7XHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50VG9rZW5zLnB1c2godG9rZW5zLnRva2Vuc1tpXSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsZXQgcmVwbGFjZW1lbnQgPSB0b2tlbnMudG9rZW5zLnNsaWNlKGksaSsxKVxyXG4gICAgICAgIGxldCB3aGVyZUFtSSA9IGk7XHJcbiAgICAgICAgbGV0IHJlc3Q9W107XHJcbiAgICAgICAgaWYgKHRva2Vucy50b2tlbnNbaV0udmFsdWUgPT09IFwiZnJhY1wiKSB7XHJcbiAgICAgICAgICAgIHdoZXJlQW1JID0gbmV3IFBvc2l0aW9uKHRva2VucywgaSk7XHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50VG9rZW5zLnB1c2goLi4udG9rZW5zLnRva2Vucy5zbGljZSh3aGVyZUFtSS5pbmRleCx3aGVyZUFtSS5pbmRleCsyKSlcclxuICAgICAgICAgICAgcmVzdD10b2tlbnMudG9rZW5zLnNsaWNlKHdoZXJlQW1JLnRyYW5zaXRpb24tMSx3aGVyZUFtSS5yaWdodC5icmVha0NoYXIpXHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50ID0gdG9rZW5zLnRva2Vucy5zbGljZShpICsgMiwgd2hlcmVBbUkudHJhbnNpdGlvbi0xKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZXtcclxuICAgICAgICAgICAgd2hlcmVBbUk9aSt0b2tlbnMudG9rZW5zLnNsaWNlKGkpLmZpbmRJbmRleCh0b2tlbiA9PiAvKD18ZnJhYykvLnRlc3QodG9rZW4udmFsdWUpKVxyXG4gICAgICAgICAgICB3aGVyZUFtST13aGVyZUFtSTxpP3Rva2Vucy50b2tlbnMubGVuZ3RoOndoZXJlQW1JO1xyXG4gICAgICAgICAgICByZXBsYWNlbWVudCA9IHRva2Vucy50b2tlbnMuc2xpY2UoaSx3aGVyZUFtSSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlcGxhY2VtZW50VG9rZW5zLnB1c2goXHJcbiAgICAgICAgICAgIC4uLmRlbm9taW5hdG9yLFxyXG4gICAgICAgICAgICB7XCJ0eXBlXCI6IFwib3BlcmF0b3JcIiwgXCJ2YWx1ZVwiOiBcIipcIn0sXHJcbiAgICAgICAgICAgIHtcInR5cGVcIjogXCJwYXJlblwiLCBcInZhbHVlXCI6IFwiKFwiLCBcImlkXCI6IDAsIFwiaW5kZXhcIjogMH0sXHJcbiAgICAgICAgICAgIC4uLnJlcGxhY2VtZW50LFxyXG4gICAgICAgICAgICB7XCJ0eXBlXCI6IFwicGFyZW5cIiwgXCJ2YWx1ZVwiOiBcIilcIiwgXCJpZFwiOiAwLCBcImluZGV4XCI6IDB9LFxyXG4gICAgICAgICAgICAuLi5yZXN0XHJcbiAgICAgICAgKTtcclxuICAgICAgICBpID0gdHlwZW9mIHdoZXJlQW1JID09PSBcIm9iamVjdFwiID8gd2hlcmVBbUkucmlnaHQuYnJlYWtDaGFyLTEgOiB3aGVyZUFtSS0xO1xyXG4gICAgfVxyXG4gICAgdG9rZW5zLnRva2Vucz1yZXBsYWNlbWVudFRva2VucztcclxufSJdfQ==