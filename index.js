const { parse } = require("./core");
const { INTENTS } = require("./constants");

const testCases = [
  {
    text: "здравствуйте хочу записаться к терапевту на завтра",
    expected: INTENTS.BOOK,
  },
  { text: "мне нужно отменить запись на пятницу", expected: INTENTS.CANCEL },
  { text: "скажите сколько стоит приём кардиолога", expected: INTENTS.INFO },
  {
    text: "это безобразие я час жду на линии хочу пожаловаться",
    expected: INTENTS.COMPLAINT,
  },
  { text: "хочу за писаться к врачу на вторник", expected: INTENTS.BOOK },
  {
    text: "мне ну это самое отменить наверное запись",
    expected: INTENTS.CANCEL,
  },
  { text: "скока стоит прием у лора", expected: INTENTS.INFO },
  {
    text: "хочу с человеком поговорить а не с роботом",
    expected: INTENTS.OPERATOR,
  },
  {
    text: "принести запись на среду вместо четверга",
    expected: INTENTS.RESCHEDULE,
  },
  { text: "ыаыы ало алё", expected: INTENTS.UNCLEAR },
  { text: "спасибо до свидания", expected: INTENTS.UNCLEAR },
];

for (const testCase of testCases) {
  const result = parse(testCase.text);
  const isSuccess = testCase.expected === result.intent;

  console.log(`
    Текст: ${testCase.text}
    Ожидаемый результат: ${testCase.expected},
    Фактический результат: ${result.intent}
    Статус: ${isSuccess ? "Успех" : "Провал"}
  `);
}
