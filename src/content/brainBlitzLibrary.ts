import type { BrainBlitzAnswer, BrainBlitzQuestion } from '../game/brainBlitzTypes';

/**
 * Built-in Brain Blitz question library. School-appropriate fictional demo
 * content (NOT research-backed survey statistics). Answers are concise and
 * carry a few natural aliases. Questions are keyed by a stable id so built-in
 * game sets can reference them.
 */

function answer(id: string, text: string, points: number, aliases: string[] = []): BrainBlitzAnswer {
  return { id, text, aliases, points };
}

function question(
  id: string,
  category: string,
  prompt: string,
  answers: BrainBlitzAnswer[],
): BrainBlitzQuestion {
  return { id, category, prompt, answers };
}

export const BRAIN_BLITZ_QUESTIONS: BrainBlitzQuestion[] = [
  // ----------------------------------------------------------------- Math --
  question('bb-math-multiple-6', 'Math', 'Name a multiple of 6.', [
    answer('bb-m6-12', '12', 35),
    answer('bb-m6-24', '24', 30),
    answer('bb-m6-18', '18', 20),
    answer('bb-m6-60', '60', 10),
    answer('bb-m6-30', '30', 5),
  ]),
  question('bb-math-shapes', 'Math', 'Name a shape with at least 4 sides.', [
    answer('bb-sh-square', 'Square', 35, ['squares']),
    answer('bb-sh-rectangle', 'Rectangle', 30, ['rectangles']),
    answer('bb-sh-pentagon', 'Pentagon', 20, ['pentagons']),
    answer('bb-sh-hexagon', 'Hexagon', 10, ['hexagons']),
    answer('bb-sh-octagon', 'Octagon', 5, ['octagons']),
  ]),
  question('bb-math-half', 'Math', 'Name a fraction equivalent to one-half.', [
    answer('bb-h-1-2', '1/2', 35, ['one over two']),
    answer('bb-h-2-4', '2/4', 30, ['two quarters']),
    answer('bb-h-3-6', '3/6', 20, ['three sixths']),
    answer('bb-h-05', '0.5', 10, ['point five']),
    answer('bb-h-50', '50%', 5, ['fifty percent']),
  ]),
  question('bb-math-even', 'Math', 'Name an even number.', [
    answer('bb-ev-2', '2', 35),
    answer('bb-ev-4', '4', 30),
    answer('bb-ev-6', '6', 20),
    answer('bb-ev-8', '8', 10),
    answer('bb-ev-10', '10', 5),
  ]),
  question('bb-math-unit', 'Math', 'Name a unit of measurement.', [
    answer('bb-u-inch', 'Inch', 35, ['inches']),
    answer('bb-u-foot', 'Foot', 30, ['feet']),
    answer('bb-u-pound', 'Pound', 20, ['pounds']),
    answer('bb-u-liter', 'Liter', 10, ['liters']),
    answer('bb-u-meter', 'Meter', 5, ['meters']),
  ]),

  // ------------------------------------------------------------- Science --
  question('bb-sci-plant', 'Science', 'Name something a plant needs.', [
    answer('bb-p-water', 'Water', 35),
    answer('bb-p-sunlight', 'Sunlight', 30, ['sun', 'light']),
    answer('bb-p-soil', 'Soil', 20, ['dirt']),
    answer('bb-p-air', 'Air', 10, ['oxygen']),
    answer('bb-p-space', 'Space', 5, ['room']),
  ]),
  question('bb-sci-matter', 'Science', 'Name a state of matter.', [
    answer('bb-m-solid', 'Solid', 35),
    answer('bb-m-liquid', 'Liquid', 30),
    answer('bb-m-gas', 'Gas', 20),
    answer('bb-m-plasma', 'Plasma', 10),
  ]),
  question('bb-sci-weather', 'Science', 'Name a type of weather.', [
    answer('bb-w-rain', 'Rain', 35, ['showers']),
    answer('bb-w-snow', 'Snow', 30, ['snowfall']),
    answer('bb-w-wind', 'Wind', 20, ['breeze']),
    answer('bb-w-hail', 'Hail', 10, ['ice pellets']),
    answer('bb-w-fog', 'Fog', 5, ['mist']),
  ]),
  question('bb-sci-planet', 'Science', 'Name a planet in our solar system.', [
    answer('bb-pl-earth', 'Earth', 35),
    answer('bb-pl-mars', 'Mars', 30),
    answer('bb-pl-jupiter', 'Jupiter', 20),
    answer('bb-pl-saturn', 'Saturn', 10),
    answer('bb-pl-venus', 'Venus', 5),
  ]),
  question('bb-sci-float', 'Science', 'Name something that floats.', [
    answer('bb-f-boat', 'Boat', 35, ['boats']),
    answer('bb-f-ball', 'Ball', 30, ['beach ball']),
    answer('bb-f-log', 'Log', 20, ['wood']),
    answer('bb-f-ice', 'Ice', 10, ['ice cube']),
    answer('bb-f-duck', 'Duck', 5, ['rubber duck']),
  ]),

  // ----------------------------------------------------------------- ELA --
  question('bb-ela-punct', 'ELA', 'Name a punctuation mark.', [
    answer('bb-punc-period', 'Period', 35, ['full stop']),
    answer('bb-punc-comma', 'Comma', 30),
    answer('bb-punc-question', 'Question mark', 20, ['?']),
    answer('bb-punc-exclam', 'Exclamation point', 10, ['!']),
    answer('bb-punc-apostrophe', 'Apostrophe', 5, ["'"]),
  ]),
  question('bb-ela-speech', 'ELA', 'Name a part of speech.', [
    answer('bb-ps-noun', 'Noun', 35, ['nouns']),
    answer('bb-ps-verb', 'Verb', 30, ['verbs']),
    answer('bb-ps-adjective', 'Adjective', 20, ['adjectives']),
    answer('bb-ps-adverb', 'Adverb', 10, ['adverbs']),
    answer('bb-ps-pronoun', 'Pronoun', 5, ['pronouns']),
  ]),
  question('bb-ela-story', 'ELA', 'Name something a good story needs.', [
    answer('bb-st-characters', 'Characters', 35, ['people']),
    answer('bb-st-plot', 'Plot', 30, ['events']),
    answer('bb-st-setting', 'Setting', 20, ['place']),
    answer('bb-st-problem', 'Problem', 10, ['conflict']),
    answer('bb-st-ending', 'Ending', 5, ['resolution']),
  ]),
  question('bb-ela-book', 'ELA', 'Name a type of book.', [
    answer('bb-bk-fiction', 'Fiction', 35, ['storybook']),
    answer('bb-bk-nonfiction', 'Nonfiction', 30, ['fact book']),
    answer('bb-bk-mystery', 'Mystery', 20, ['mysteries']),
    answer('bb-bk-poetry', 'Poetry', 10, ['poems']),
    answer('bb-bk-biography', 'Biography', 5, ['biographies']),
  ]),
  question('bb-ela-vowel', 'ELA', 'Name a vowel.', [
    answer('bb-v-a', 'A', 35),
    answer('bb-v-e', 'E', 30),
    answer('bb-v-i', 'I', 20),
    answer('bb-v-o', 'O', 10),
    answer('bb-v-u', 'U', 5),
  ]),

  // --------------------------------------------------------- Kid Interest --
  question('bb-kid-recess', 'Kid Interest', 'Name something kids do at recess.', [
    answer('bb-r-tag', 'Tag', 35, ['chase']),
    answer('bb-r-swinging', 'Swinging', 30, ['swings']),
    answer('bb-r-basketball', 'Basketball', 20, ['hoops']),
    answer('bb-r-jump', 'Jump rope', 10, ['skipping']),
    answer('bb-r-foursquare', 'Four square', 5, ['4 square']),
  ]),
  question('bb-kid-backpack', 'Kid Interest', 'Name something found in a backpack.', [
    answer('bb-bp-pencil', 'Pencil', 35, ['pen']),
    answer('bb-bp-lunch', 'Lunch', 30, ['lunchbox']),
    answer('bb-bp-books', 'Books', 20, ['textbooks']),
    answer('bb-bp-bottle', 'Water bottle', 10, ['water']),
    answer('bb-bp-notebook', 'Notebook', 5, ['notebooks']),
  ]),
  question('bb-kid-pizza', 'Kid Interest', 'Name a pizza topping.', [
    answer('bb-pz-cheese', 'Cheese', 35, ['mozzarella']),
    answer('bb-pz-pepperoni', 'Pepperoni', 30),
    answer('bb-pz-mushrooms', 'Mushrooms', 20, ['mushroom']),
    answer('bb-pz-olives', 'Olives', 10, ['olive']),
    answer('bb-pz-pineapple', 'Pineapple', 5),
  ]),
  question('bb-kid-party', 'Kid Interest', 'Name something at a birthday party.', [
    answer('bb-py-cake', 'Cake', 35, ['birthday cake']),
    answer('bb-py-balloons', 'Balloons', 30, ['balloon']),
    answer('bb-py-presents', 'Presents', 20, ['gifts']),
    answer('bb-py-games', 'Games', 10, ['party games']),
    answer('bb-py-icecream', 'Ice cream', 5),
  ]),
  question('bb-kid-subject', 'Kid Interest', 'Name a school subject.', [
    answer('bb-sub-math', 'Math', 35, ['maths']),
    answer('bb-sub-science', 'Science', 30),
    answer('bb-sub-reading', 'Reading', 20, ['ela']),
    answer('bb-sub-art', 'Art', 10),
    answer('bb-sub-music', 'Music', 5),
  ]),
];

const QUESTION_BY_ID: Map<string, BrainBlitzQuestion> = new Map(
  BRAIN_BLITZ_QUESTIONS.map((question) => [question.id, question]),
);

/** Deep-copy a set of questions (new answer/alias references, preserved ids). */
export function buildBrainBlitzQuestions(ids: string[]): BrainBlitzQuestion[] {
  return ids.flatMap((id) => {
    const definition = QUESTION_BY_ID.get(id);
    if (!definition) return [];
    return [
      {
        ...definition,
        answers: definition.answers.map((answer) => ({ ...answer, aliases: [...answer.aliases] })),
      },
    ];
  });
}
