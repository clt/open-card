import { describe, expect, test } from "bun:test";
import {
  canBeat,
  canPass,
  chooseAutomatedPlay,
  describeCombo,
  validatePlay,
  type KnownCard,
  type Rank,
  type Suit,
} from "../examples/big2-demo/src/big2";

describe("Big 2 demo rules", () => {
  test("the opening play must include 3D", () => {
    expect(validatePlay([card("3C")], { activePlay: null, isFirstPlay: true, requiredOpeningCode: "3D" }).ok).toBe(false);
    expect(validatePlay([card("3D")], { activePlay: null, isFirstPlay: true, requiredOpeningCode: "3D" }).ok).toBe(true);
  });

  test("describes singles, pairs, triples, and five-card hands", () => {
    expect(describeCombo([card("AS")])?.kind).toBe("single");
    expect(describeCombo([card("5D"), card("5S")])?.kind).toBe("pair");
    expect(describeCombo([card("9D"), card("9C"), card("9S")])?.kind).toBe("triple");
    expect(describeCombo([card("3D"), card("4C"), card("5H"), card("6S"), card("7D")])?.kind).toBe("straight");
    expect(describeCombo([card("3S"), card("6S"), card("9S"), card("JS"), card("AS")])?.kind).toBe("flush");
    expect(describeCombo([card("7D"), card("7C"), card("7S"), card("QD"), card("QC")])?.kind).toBe("fullHouse");
    expect(describeCombo([card("KD"), card("KC"), card("KH"), card("KS"), card("4D")])?.kind).toBe("fourOfAKind");
    expect(describeCombo([card("9H"), card("10H"), card("JH"), card("QH"), card("KH")])?.kind).toBe("straightFlush");
  });

  test("compares Big 2 cards and five-card categories", () => {
    const lowSingle = describeCombo([card("AD")])!;
    const highSingle = describeCombo([card("2D")])!;
    const straight = describeCombo([card("3D"), card("4C"), card("5H"), card("6S"), card("7D")])!;
    const flush = describeCombo([card("3S"), card("6S"), card("9S"), card("JS"), card("AS")])!;

    expect(canBeat(highSingle, lowSingle)).toBe(true);
    expect(canBeat(flush, straight)).toBe(true);
    expect(canBeat(straight, flush)).toBe(false);
  });

  test("automated opening can lead a pair that includes 3D", () => {
    const play = chooseAutomatedPlay([card("4S"), card("3D"), card("3C"), card("8H")], {
      activePlay: null,
      isFirstPlay: true,
      requiredOpeningCode: "3D",
    });

    expect(play?.combo.kind).toBe("pair");
    expect(play?.cards.map((item) => item.code)).toEqual(["3D", "3C"]);
  });

  test("automated open leads prefer five-card hands, triples, then pairs before singles", () => {
    const straightLead = chooseAutomatedPlay(
      [card("3D"), card("4C"), card("5H"), card("6S"), card("7D"), card("9D"), card("9C"), card("QH")],
      { activePlay: null, isFirstPlay: false },
    );
    const tripleLead = chooseAutomatedPlay([card("3D"), card("3C"), card("3H"), card("8S"), card("QD")], {
      activePlay: null,
      isFirstPlay: false,
    });
    const pairLead = chooseAutomatedPlay([card("3D"), card("3C"), card("8H"), card("QS")], {
      activePlay: null,
      isFirstPlay: false,
    });

    expect(straightLead?.combo.kind).toBe("straight");
    expect(straightLead?.cards.map((item) => item.code)).toEqual(["3D", "4C", "5H", "6S", "7D"]);
    expect(tripleLead?.combo.kind).toBe("triple");
    expect(tripleLead?.cards.map((item) => item.code)).toEqual(["3D", "3C", "3H"]);
    expect(pairLead?.combo.kind).toBe("pair");
    expect(pairLead?.cards.map((item) => item.code)).toEqual(["3D", "3C"]);
  });

  test("automated responses still choose the weakest legal answer to the active play", () => {
    const activePlay = describeCombo([card("6D")])!;
    const play = chooseAutomatedPlay([card("7D"), card("7C"), card("8H"), card("QS")], {
      activePlay,
      isFirstPlay: false,
    });

    expect(play?.combo.kind).toBe("single");
    expect(play?.cards.map((item) => item.code)).toEqual(["7D"]);
  });

  test("passing is only available when there is an active play", () => {
    const activePlay = describeCombo([card("6S")])!;
    expect(canPass({ activePlay: null, isFirstPlay: false })).toBe(false);
    expect(canPass({ activePlay, isFirstPlay: false })).toBe(true);
  });
});

function card(code: string): KnownCard {
  const suitCode = code.at(-1);
  const rank = code.slice(0, -1) as Rank;
  const suitByCode: Record<string, Suit> = {
    C: "clubs",
    D: "diamonds",
    H: "hearts",
    S: "spades",
  };
  const suit = suitCode === undefined ? undefined : suitByCode[suitCode];

  if (suit === undefined) {
    throw new Error(`Invalid card code ${code}.`);
  }

  return {
    id: `card_${code}`,
    code,
    rank,
    suit,
    label: code,
  };
}
