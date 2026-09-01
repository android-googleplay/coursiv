import type { CoursivContentBlock, CoursivLesson, CoursivLessonScreen } from "@/lib/coursiv-content";

const sourcePageId = "basic-law-articles-1-2-12";

function contentScreen(order: number, title: string, paragraphs: string[], image?: { src: string; alt: string }): CoursivLessonScreen {
  return {
    id: `basic-law-screen-${order + 1}`,
    sourcePageId,
    order,
    type: "chunk",
    presentation: "content",
    interactionPolicy: "read",
    blocks: [
      { id: `basic-law-screen-${order + 1}-heading`, type: "heading", level: 2, text: title },
      ...paragraphs.map((text, index) => ({
        id: `basic-law-screen-${order + 1}-paragraph-${index + 1}`,
        type: "paragraph" as const,
        text,
      })),
      ...(image ? [{
        id: `basic-law-screen-${order + 1}-image`,
        type: "image" as const,
        src: image.src,
        localSrc: image.src,
        alt: image.alt,
      }] : []),
    ],
  };
}

function calloutScreen(order: number, title: string, text: string): CoursivLessonScreen {
  return {
    id: `basic-law-screen-${order + 1}`,
    sourcePageId,
    order,
    type: "callout",
    title,
    presentation: "callout",
    interactionPolicy: "read",
    blocks: [{ id: `basic-law-screen-${order + 1}-callout`, type: "callout", title, text, tone: "tip" }],
  };
}

function quizScreen(
  order: number,
  question: string,
  options: Array<{ label: string; correct?: boolean }>,
  correct: string,
  incorrect: string,
): CoursivLessonScreen {
  return {
    id: `basic-law-screen-${order + 1}`,
    sourcePageId,
    order,
    type: "single-choice",
    presentation: "knowledge-check",
    interactionPolicy: "required-interaction",
    blocks: [{
      id: `basic-law-screen-${order + 1}-quiz`,
      type: "single-choice",
      question,
      options: options.map((option, index) => ({
        id: `basic-law-screen-${order + 1}-option-${index + 1}`,
        label: option.label,
        isCorrect: option.correct === true,
      })),
      feedbackCorrect: { text: correct },
      feedbackIncorrect: { text: incorrect },
    }],
  };
}

type PracticeBlock = Extract<CoursivContentBlock, { type: "fill-in-blank" | "matching-pairs" | "ordering-task" }>;

function practiceScreen(order: number, title: string, block: PracticeBlock): CoursivLessonScreen {
  return {
    id: `basic-law-screen-${order + 1}`,
    sourcePageId,
    order,
    type: "practice-preview",
    title,
    presentation: "practice",
    interactionPolicy: "optional-practice",
    practiceTool: { name: "Basic Law" },
    blocks: [block],
  };
}

const screens: CoursivLessonScreen[] = [
  contentScreen(0, "香港特區地位與高度自治", [
    "考試最常見嘅陷阱，唔係你未見過條文，而係選項將幾個正確詞語重新拼埋，變成一個錯誤結論。",
    "今課只處理三條：第一條、第二條、第十二條。你會建立一條判斷鏈：<b>地位 → 授權 → 行政關係</b>。",
  ], {
    src: "/images/courses/basic-law/status-authority-relationship.png",
    alt: "",
  }),
  contentScreen(1, "先學識睇選項", [
    "見到「高度自治 High Degree of Autonomy」唔代表成句一定正確。你要再問：自治權由邊度來？有冇受《基本法》規定約束？",
    "正式題目會用熟悉字眼降低你嘅戒心。今課每個互動都要求你先找法律關係，再揀答案。",
  ]),
  contentScreen(2, "今課重點", [
    "<ul><li><b>第一條｜地位：</b>香港特區是中華人民共和國不可分離的部分。</li><li><b>第二條｜授權：</b>全國人民代表大會授權香港特區依照《基本法》實行高度自治。</li><li><b>第十二條｜行政關係：</b>香港特區直轄於中央人民政府。</li></ul>",
  ]),
  contentScreen(3, "第一條：先鎖定國家地位", [
    "第一條原文係：「香港特別行政區是中華人民共和國不可分離的部分。」",
    "關鍵英文係 <b>an inalienable part of the People's Republic of China</b>。所以「高度自治」唔會令香港特區變成獨立主權國家。",
  ]),
  contentScreen(4, "第一個常見陷阱", [
    "錯誤選項通常唔會完全離題，而係將「地方行政區域」、「高度自治」同「獨立」混埋。",
    "判斷方法好簡單：凡係同「不可分離的部分」矛盾，就唔可能符合第一條。",
  ]),
  quizScreen(5,
    "根據《基本法》第一條，以下邊一項最準確？<br>According to Article 1 of the Basic Law, which statement is the most accurate?",
    [
      { label: "香港特區是中華人民共和國不可分離的部分。 The HKSAR is an inalienable part of the PRC.", correct: true },
      { label: "香港特區因為實行高度自治，所以屬於獨立政治實體。 The HKSAR is an independent political entity because it enjoys a high degree of autonomy." },
      { label: "香港特區與中央人民政府之間沒有隸屬關係。 The HKSAR has no subordinate relationship with the Central People's Government." },
    ],
    "正確。第一條直接界定香港特區嘅國家地位。先確認「不可分離的部分」，再分析自治權。",
    "未中。高度自治唔會改變第一條所訂明嘅國家地位。返去鎖定關鍵詞：「不可分離的部分」。",
  ),
  practiceScreen(6, "砌返三條判斷鏈", {
    id: "basic-law-screen-7-fill",
    type: "fill-in-blank",
    prompt: "用三個關鍵詞完成句子。",
    template: "香港特區是中華人民共和國[地位]；全國人民代表大會[權力來源]香港特區依照《基本法》實行高度自治；香港特區[行政關係]於中央人民政府。",
    placeholders: ["地位", "權力來源", "行政關係"],
    tokens: ["直轄", "不可分離的部分", "授權"],
    correctTokens: ["不可分離的部分", "授權", "直轄"],
    exampleResponse: "完整判斷鏈：不可分離的部分 → 全國人大授權 → 直轄中央人民政府。",
  }),
  quizScreen(7,
    "一個選項話：「香港享有高度自治，因此自治權本身不受《基本法》規限。」應該點判斷？<br>An option states: “Hong Kong enjoys a high degree of autonomy, so that autonomy is not limited by the Basic Law.” How should it be assessed?",
    [
      { label: "正確 Correct" },
      { label: "錯誤 Incorrect", correct: true },
      { label: "只要涉及行政管理權就正確 Correct whenever administrative power is involved" },
    ],
    "啱。第二條寫明係「依照本法的規定」實行高度自治，所以唔係無限制權力。",
    "再睇第二條嘅限制語：「依照本法的規定」。高度自治並唔等於不受《基本法》規限。",
  ),
  calloutScreen(8, "考試鏡頭：先找限制語", "遇到「全部」、「任何情況」、「完全不受限制」等絕對字眼，要立即回到條文。第二條嘅「依照本法的規定」係重要限制語。"),
  contentScreen(9, "第二條：權力來源", [
    "第二條原文以「全國人民代表大會授權」開始。即係香港特區實行高度自治嘅權力來源，係全國人民代表大會嘅授權。",
    "英文關鍵詞：<b>The National People's Congress authorizes the HKSAR</b>。",
  ]),
  contentScreen(10, "授權，而唔係固有", [
    "如果選項話高度自治係香港特區「本身固有」或者「自行取得」嘅權力，就同第二條唔一致。",
    "答題時唔需要推論政治理論，只需要準確對照條文用字：<b>授權 authorizes</b>。",
  ]),
  contentScreen(11, "高度自治包括咩權力？", [
    "第二條列出四項：行政管理權、立法權、獨立的司法權和終審權。",
    "記憶時分兩組：<b>行政＋立法</b>，再加 <b>獨立司法＋終審</b>。題目可能抽走其中一項，或者加入條文冇寫嘅權力。",
  ]),
  contentScreen(12, "「獨立司法」唔等於「獨立國家」", [
    "第二條講嘅係「獨立的司法權」，形容一項司法權力；第一條講嘅係香港特區嘅國家地位。兩者層次唔同。",
    "見到同一個「獨立」字，唔可以跨層次拼成「獨立主權國家」。",
  ]),
  contentScreen(13, "四權陷阱", [
    "最穩陣嘅做法唔係死背長句，而係檢查選項有冇保持原本四項：行政管理、立法、獨立司法、終審。",
    "如果出現「外交權」或「國防權」，唔可以因為旁邊有幾個正確詞就接受成句。",
  ]),
  contentScreen(14, "自治必須依照《基本法》", [
    "第二條將權力來源同運作限制放喺同一句：全國人大授權，而且要依照《基本法》的規定實行。",
    "所以完整理解唔係「香港有高度自治」六個字，而係：<b>獲授權、依法實行</b>。",
  ]),
  contentScreen(15, "情境：選項只講一半", [
    "假設選項寫：「香港特區享有行政管理權、立法權、獨立司法權和終審權。」單看呢句，列出嘅權力符合第二條。",
    "但如果再加「這些權力並非來自全國人大授權」，整個選項就錯。考試係判斷完整陳述，唔係計有幾多個詞正確。",
  ]),
  contentScreen(16, "將第一、第二條連起來", [
    "第一條回答：香港特區係中國嘅邊一部分？第二條回答：高度自治由誰授權、包括哪些權力、依照甚麼規定實行？",
    "一條定地位，一條定授權。兩條唔互相抵消，而係一齊構成法律關係。",
  ]),
  contentScreen(17, "到第十二條：行政關係", [
    "第十二條原文：「香港特別行政區是中華人民共和國的一個享有高度自治權的地方行政區域，直轄於中央人民政府。」",
    "英文關鍵詞：<b>a local administrative region ... which shall come directly under the Central People's Government</b>。",
  ]),
  calloutScreen(18, "一句拆兩層", "第十二條同時講兩件事：香港特區係享有高度自治權嘅地方行政區域；同時直轄中央人民政府。題目將其中一半刪走，就可能扭曲完整關係。"),
  contentScreen(19, "三條合併成一幅圖", [
    "<ul><li><b>第一條：</b>不可分離的部分。</li><li><b>第二條：</b>全國人大授權，依照《基本法》實行高度自治。</li><li><b>第十二條：</b>享有高度自治權的地方行政區域，直轄中央人民政府。</li></ul>",
    "你唔需要額外發明第四個概念。所有判斷都先放回呢三個位置。",
  ]),
  practiceScreen(20, "條文配對", {
    id: "basic-law-screen-21-match",
    type: "matching-pairs",
    title: "條文配對",
    prompt: "將每條條文配對到最核心嘅法律功能。",
    pairs: [
      { id: "article-1", left: "第一條 Article 1", right: "國家地位：不可分離的部分" },
      { id: "article-2", left: "第二條 Article 2", right: "權力來源：全國人大授權" },
      { id: "article-12", left: "第十二條 Article 12", right: "行政關係：直轄中央人民政府" },
    ],
  }),
  practiceScreen(21, "三步拆題", {
    id: "basic-law-screen-22-order",
    type: "ordering-task",
    title: "三步拆題",
    prompt: "將判斷一個「高度自治」選項嘅步驟排好次序。",
    items: [
      "先確認選項有冇違反「不可分離的部分」",
      "再確認高度自治是否源自全國人大授權",
      "最後檢查是否依照《基本法》及保持直轄關係",
    ],
    correctItems: [
      "先確認選項有冇違反「不可分離的部分」",
      "再確認高度自治是否源自全國人大授權",
      "最後檢查是否依照《基本法》及保持直轄關係",
    ],
    feedbackCorrect: { text: "次序正確：地位 → 授權 → 規限及行政關係。" },
    feedbackIncorrect: { text: "先由第一條確認國家地位，再處理第二條授權，最後用第二及第十二條檢查限制與行政關係。" },
  }),
  quizScreen(22,
    "以下邊一項完整反映第一、第二及第十二條？<br>Which statement accurately reflects Articles 1, 2 and 12 as a whole?",
    [
      { label: "香港特區是中國不可分離的部分；全國人大授權其依照《基本法》實行高度自治；香港特區直轄中央人民政府。 The HKSAR is an inalienable part of China; the NPC authorizes it to exercise a high degree of autonomy in accordance with the Basic Law; and it comes directly under the Central People's Government.", correct: true },
      { label: "香港特區因享有高度自治，所以可自行決定是否接受中央人民政府管轄。 Because it enjoys a high degree of autonomy, the HKSAR may decide whether to come under the Central People's Government." },
      { label: "香港特區的高度自治屬固有權力，不受《基本法》規限。 The HKSAR's high degree of autonomy is inherent and unrestricted by the Basic Law." },
    ],
    "正確。呢個選項同時保留三個法律關係：不可分離、全國人大授權並依法實行、直轄中央人民政府。",
    "未完整符合三條條文。檢查三個位置：國家地位、權力來源及行政關係；任何一個被改寫，整句都錯。",
  ),
  contentScreen(23, "今課真正要帶走嘅唔係三句口號", [
    "你要記住一條可重複使用嘅判斷鏈：<b>第一條定地位；第二條定授權及自治範圍；第十二條定地方行政區域及直轄關係。</b>",
    "遇到選項時，逐格核對。唔好因為見到「高度自治」就立即揀。",
  ]),
  practiceScreen(24, "最後一次主動回想", {
    id: "basic-law-screen-25-fill",
    type: "fill-in-blank",
    prompt: "唔睇筆記，完成三個最重要關鍵詞。",
    template: "第一條：[地位]；第二條：[授權]；第十二條：[行政關係]。",
    placeholders: ["地位", "授權", "行政關係"],
    tokens: ["直轄中央人民政府", "全國人大授權", "不可分離的部分"],
    correctTokens: ["不可分離的部分", "全國人大授權", "直轄中央人民政府"],
    exampleResponse: "不可分離的部分 → 全國人大授權 → 直轄中央人民政府。",
  }),
  contentScreen(25, "由理解去到應試", [
    "今課用同一組概念完成咗三次處理：先理解條文、再主動回想、最後綜合判斷。呢個先係重複強化，而唔係重複睇同一句。",
    "下一次重溫時，先嘗試由「1—2—12」自己講出三個重點，再開始做題。",
  ]),
  contentScreen(26, "下一課：中央與香港特區的職權", [
    "下一課會沿用同一節奏，處理中央人民政府負責管理嘅事務，以及香港特區可自行處理嘅範圍。",
    "官方來源：<a href=\"https://www.basiclaw.gov.hk/tc/basiclaw/chapter1.html\" target=\"_blank\" rel=\"noopener noreferrer\">《基本法》第一章</a>、<a href=\"https://www.basiclaw.gov.hk/tc/basiclaw/chapter2.html\" target=\"_blank\" rel=\"noopener noreferrer\">第二章</a>。",
  ]),
];

export const basicLawStatusAutonomyLesson: CoursivLesson = {
  schemaVersion: 3,
  sourceId: "basic-law-status-autonomy",
  sourceUnitId: "basic-law-foundations",
  sourceGuideId: "basic-law-status-autonomy",
  slug: "status-and-high-degree-of-autonomy",
  title: "香港特區地位與高度自治",
  order: 0,
  readUrl: "https://www.basiclaw.gov.hk/tc/basiclaw/index.html",
  hasAudio: false,
  screens,
  blocks: screens.flatMap((screen) => screen.blocks),
  raw: {
    referenceStructure: "content/coursiv/courses/claude.json#Meet Claude",
    officialArticles: [1, 2, 12],
  },
};
