import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const ocrPath = "/Users/chibonlaw/Downloads/基本法及國安法測試_OCR.txt";
const verifiedAt = "2026-08-11";
const basicLawUrl = "https://www.basiclaw.gov.hk/en/basiclawtext/index.html";
const nslUrl = "https://www.isd.gov.hk/nationalsecurity/eng/law.html";
const nslOfficialPdf = "https://www.elegislation.gov.hk/hk/A302!zh-Hant-HK.assist.pdf";

function basicLawChapter(article) {
  if (article <= 11) return 1;
  if (article === 12) return 2;
  if (article <= 23) return 3;
  if (article <= 42) return 4;
  if (article <= 104) return 5;
  if (article <= 135) return 6;
  if (article <= 149) return 7;
  if (article <= 157) return 8;
  return 9;
}

const supplementalReferences = [
  {id:"basic-law-preamble",domain:"basic-law",article:null,citationZh:"《基本法》序言",citationEn:"Preamble to the Basic Law",textZh:"香港自古以來就是中國的領土，一九八四年十二月十九日，中英兩國政府簽署了關於香港問題的聯合聲明。根據中華人民共和國憲法，全國人民代表大會特制定中華人民共和國香港特別行政區基本法，規定香港特別行政區實行的制度，以保障國家對香港的基本方針政策的實施。",textEn:"The Preamble records the Sino-British Joint Declaration and states that the National People's Congress enacted the Basic Law under the Constitution to prescribe the systems practised in Hong Kong.",sourceUrl:"https://www.basiclaw.gov.hk/tc/basiclaw/preamble.html",verifiedAt},
  {id:"basic-law-annex-1",domain:"basic-law",article:null,citationZh:"《基本法》附件一",citationEn:"Annex I to the Basic Law",textZh:"行政長官由選舉委員會根據本法選出，由中央人民政府任命。選舉委員會委員共1500人，每個界別300人；第五界別是香港特別行政區全國人大代表、香港特別行政區全國政協委員和有關全國性團體香港成員的代表界。選舉委員會根據提名名單，經一人一票無記名投票選出行政長官候任人。",textEn:"Annex I provides for a 1,500-member Election Committee, describes its five sectors and requires the Chief Executive candidate to be selected by secret ballot on a one-person-one-vote basis.",sourceUrl:"https://www.basiclaw.gov.hk/tc/basiclaw/annex1.html",verifiedAt},
  {id:"basic-law-annex-2",domain:"basic-law",article:null,citationZh:"《基本法》附件二",citationEn:"Annex II to the Basic Law",textZh:"附件二訂明香港特別行政區立法會的產生辦法和表決程序；相關安排曾經依法修改。",textEn:"Annex II prescribes the formation and voting procedures of the Legislative Council and has been amended in accordance with law.",sourceUrl:"https://www.basiclaw.gov.hk/tc/basiclaw/annex2.html",verifiedAt},
  {id:"basic-law-annex-3",domain:"basic-law",article:null,citationZh:"《基本法》附件三及現行全國性法律名單",citationEn:"Annex III and the current list of national laws",textZh:"在香港特別行政區實施的全國性法律包括：《關於中華人民共和國國都、紀年、國歌、國旗的決議》、《關於中華人民共和國國慶日的決議》、《中華人民共和國政府關於領海的聲明》、《中華人民共和國國籍法》、《中華人民共和國外交特權與豁免條例》、《中華人民共和國國旗法》、《中華人民共和國領事特權與豁免條例》、《中華人民共和國國徽法》、《中華人民共和國領海及毗連區法》、《中華人民共和國香港特別行政區駐軍法》、《中華人民共和國專屬經濟區和大陸架法》、《中華人民共和國國歌法》及《中華人民共和國香港特別行政區維護國家安全法》。",textEn:"Annex III and subsequent decisions provide the current list of national laws applied in Hong Kong by promulgation or local legislation.",sourceUrl:"https://www.basiclaw.gov.hk/tc/basiclaw/national-laws.html",verifiedAt},
  {id:"basic-law-related-documents",domain:"basic-law",article:null,citationZh:"《基本法》相關文件",citationEn:"Documents related to the Basic Law",textZh:"《基本法》正文、附件、全國人大常委會解釋及相關決定共同構成題目所需核對的官方資料。",textEn:"The Basic Law text, annexes, interpretations and related decisions provide the official materials needed for verification.",sourceUrl:"https://www.basiclaw.gov.hk/tc/basiclaw/index.html",verifiedAt},
  {id:"nsl-promulgation-2020",domain:"nsl",article:null,citationZh:"《香港國安法》公布安排",citationEn:"Promulgation of the Hong Kong National Security Law",textZh:"《香港國安法》由全國人大常委會通過並列入《基本法》附件三，在香港特別行政區公布實施。",textEn:"The Hong Kong National Security Law was adopted by the NPC Standing Committee, added to Annex III and promulgated in Hong Kong.",sourceUrl:nslOfficialPdf,verifiedAt},
];

const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char === "百") { total += (current || 1) * 100; current = 0; }
    else if (char === "十") { total += (current || 1) * 10; current = 0; }
    else if (char in digits) current = digits[char];
  }
  return total + current;
}

function normalizeChineseSpacing(value) {
  let result = String(value ?? "");
  let previous;
  do {
    previous = result;
    result = result.replace(/([\p{Script=Han}）》」〉])\s+([\p{Script=Han}《「〈])/gu, "$1$2");
  } while (result !== previous);
  return result;
}

const QUESTION_BLANK = "__________";

function normalizeQuestionBlanks(value) {
  return String(value ?? "")
    .replace(/[_＿﹍﹎﹏](?:\s*[_＿﹍﹎﹏])*(?:\s*[—–-](?=[\s，。；：！？、?!,.;:]|$))?/gu, QUESTION_BLANK)
    .replace(/(^|\s)[—–-](?=\s|[，。；：！？、?!,.;:]|$)/gu, `$1${QUESTION_BLANK}`);
}

const clean = (value) => normalizeChineseSpacing(String(value ?? "")
  .replaceAll("\r", "")
  .replace(/\u00a0/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/\s+([，。？！：；、])/g, "$1")
  .replace(/([（《「])\s+/g, "$1")
  .replace(/\s+([）》」])/g, "$1")
  .replace(/\n+/g, " "))
  .trim();

const stripHtml = (value) => clean(value
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<\/p>/gi, "\n")
  .replace(/<li[^>]*>/gi, "• ")
  .replace(/<[^>]+>/g, "")
  .replaceAll("&nbsp;", " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">"));

const lessonDefs = [
  ["exam-map", "考試玩法與高頻陷阱", "考試策略", [], ["先讀否定詞", "再鎖定權力主體", "最後核對數字與程序"]],
  ["preamble-articles-1-5", "序言與一國兩制基礎", "序言及第 1–5 條", [1,2,3,4,5], ["香港係中國不可分離部分", "高度自治源自全國人大授權", "原有制度按《基本法》維持"]],
  ["articles-6-11", "財產、土地、法律與區旗", "第 6–11 條", [6,7,8,9,10,11], ["香港依法保障私人及法人財產", "土地及自然資源屬國家所有", "原有法律原則上保留"]],
  ["articles-12-18", "中央與香港特區嘅關係", "第 12–18 條", [12,13,14,15,16,17,18], ["香港直轄中央人民政府", "香港特區外交與防務由中央人民政府負責", "附件三全國性法律在香港公布或立法實施"]],
  ["articles-19-23", "司法管轄與維護國家安全", "第 19–23 條", [19,20,21,22,23], ["香港法院依法獨立審判", "中央各部門等不得干預香港特區自行管理嘅事務", "香港特區須按《基本法》第 23 條自行立法"]],
  ["articles-24-26", "邊個係香港居民？", "第 24–26 條", [24,25,26], ["居民包括永久及非永久居民", "居民在法律面前一律平等", "永久居民依法享有選舉權"]],
  ["articles-27-32", "核心自由與人身保障", "第 27–32 條", [27,28,29,30,31,32], ["多項基本自由受保障", "人身自由不受侵犯", "通訊自由受法律保護"]],
  ["articles-33-39", "法律、社會與文化權利", "第 33–39 條", [33,34,35,36,37,38,39], ["居民有選擇職業自由", "香港居民有權獲保密法律諮詢", "兩項人權國際公約原適用香港嘅規定繼續有效"]],
  ["articles-40-42", "傳統權益與守法義務", "第 40–42 條", [40,41,42], ["原居民合法傳統權益受保護", "非居民依法享有本章權利自由", "居民有遵守法律義務"]],
  ["articles-43-47", "行政長官地位與產生", "第 43–47 條", [43,44,45,46,47], ["行政長官代表香港特區", "行政長官由中央人民政府任命", "行政長官須廉潔奉公及盡忠職守"]],
  ["articles-48-53", "行政長官職權與辭職", "第 48–53 條", [48,49,50,51,52,53], ["行政長官法定職權要逐項核對", "行政長官退回法案有指定程序", "行政長官在法定情況下必須辭職"]],
  ["articles-54-65", "行政會議、政府與律政司", "第 54–65 條", [54,55,56,57,58,59,60,61,62,63,64,65], ["行政會議協助行政長官決策", "香港特區政府係行政機關", "律政司主管刑事檢控並不受干涉"]],
  ["articles-66-71", "立法會組成與主席", "第 66–71 條", [66,67,68,69,70,71], ["立法會係立法機關", "立法會組成與產生辦法受《基本法》規限", "立法會主席有特定資格要求"]],
  ["articles-72-79", "立法會權力與議員資格", "第 72–79 條", [72,73,74,75,76,77,78,79], ["主席、立法會、議員職權要分清", "立法會法定人數以全體議員計", "議員言論及表決受保障"]],
  ["articles-80-96", "法院與獨立司法", "第 80–96 條", Array.from({length:17},(_,i)=>80+i), ["香港法院獨立進行審判", "終審權屬香港特區", "香港法官任免有指定程序"]],
  ["articles-97-104", "區域組織與公務人員", "第 97–104 條", Array.from({length:8},(_,i)=>97+i), ["區域組織屬非政權性", "公務制度原則上保留", "指定公職人員須依法宣誓"]],
  ["articles-105-113", "財政、稅制與港元", "第 105–113 條", Array.from({length:9},(_,i)=>105+i), ["香港依法保障私人及法人財產權", "香港特區保持財政獨立，收入不上繳中央", "外匯基金由特區政府管理"]],
  ["articles-114-127", "貿易、工商與航運", "第 114–127 條", Array.from({length:14},(_,i)=>114+i), ["香港保持自由港地位", "香港係單獨關稅地區", "船舶可用中國香港名義登記"]],
  ["articles-128-135", "民用航空安排", "第 128–135 條", Array.from({length:8},(_,i)=>128+i), ["香港特區自行負責民航日常及技術管理", "指定民用航空協定由中央人民政府簽訂", "香港特區政府可按中央授權簽發民航牌照"]],
  ["articles-136-149", "教育、文化、宗教與社會政策", "第 136–149 條", Array.from({length:14},(_,i)=>136+i), ["香港自行制定多項社會政策", "院校保留自主與學術自由", "宗教組織依法維持活動"]],
  ["articles-150-157", "對外事務與中國香港", "第 150–157 條", Array.from({length:8},(_,i)=>150+i), ["香港特區代表可參加直接影響香港嘅外交談判", "香港特區可用中國香港名義發展對外關係", "外國在香港設立領事機構須經中央批准"]],
  ["articles-158-160", "解釋、修改與附則", "第 158–160 條", [158,159,160], ["《基本法》解釋權屬全國人大常委會", "《基本法》修改權屬全國人大", "香港原有法律除被宣布抵觸《基本法》外予以採用"]],
  ["annexes", "附件一至三與相關文件", "附件及相關文件", [], ["附件一處理行政長官產生辦法", "附件二處理立法會產生與表決", "附件三列明在港實施全國性法律"]],
  ["nsl-articles-1-6", "國安法基礎與總則", "《香港國安法》第 1–6 條", [1,2,3,4,5,6], ["中央對香港國安負根本責任，香港特區負憲制責任", "《香港國安法》保障人權並採用無罪推定", "參選或就任公職須擁護《基本法》及效忠香港特區"]],
  ["nsl-articles-7-19", "維護國家安全嘅職責與機構", "《香港國安法》第 7–19 條", Array.from({length:13},(_,i)=>7+i), ["香港特區須完善維護國安法律及執行機制", "香港國安委負責香港維護國家安全事務", "警務處及律政司設專責部門"]],
  ["nsl-articles-20-30", "四類危害國家安全罪行", "《香港國安法》第 20–30 條", Array.from({length:11},(_,i)=>20+i), ["四類罪行構成要件各有不同", "武力並非所有罪行必要條件", "唔可以用相似字眼互換罪名"]],
  ["nsl-articles-31-47", "刑罰、效力與案件程序", "《香港國安法》第 31–47 條", Array.from({length:17},(_,i)=>31+i), ["法人亦可能負刑事責任", "《香港國安法》適用於條文指定嘅境外行為", "國安案件嘅管轄、保釋及審訊有特別程序"]],
  ["nsl-articles-48-66", "駐港國安公署與附則", "《香港國安法》第 48–66 條", Array.from({length:19},(_,i)=>48+i), ["駐港國安公署有法定職責", "駐港國安公署只可按第 55 條管轄特定案件", "《香港國安法》解釋權屬全國人大常委會"]],
].map(([slug,title,scope,articles,keys],index)=>({slug,title,scope,articles,keys,order:index,domain:index>=23?"nsl":"basic-law"}));

const spotErrorBySlug = {
  "exam-map": {wrongIndex:0,wrong:"見到熟悉字眼就直接作答"},
  "preamble-articles-1-5": {wrongIndex:1,wrong:"高度自治係香港自行擁有嘅權力"},
  "articles-6-11": {wrongIndex:1,wrong:"土地及自然資源屬香港特區政府所有"},
  "articles-12-18": {wrongIndex:1,wrong:"香港特區自行負責外交與防務"},
  "articles-19-23": {wrongIndex:1,wrong:"中央各部門可干預香港特區自行管理嘅事務"},
  "articles-24-26": {wrongIndex:2,wrong:"所有香港居民都依法享有選舉權"},
  "articles-27-32": {wrongIndex:1,wrong:"人身自由可不經法律程序受到限制"},
  "articles-33-39": {wrongIndex:1,wrong:"香港居民只可獲公開法律諮詢"},
  "articles-40-42": {wrongIndex:1,wrong:"非居民唔受本章權利同自由保障"},
  "articles-43-47": {wrongIndex:1,wrong:"行政長官由香港特區政府任命"},
  "articles-48-53": {wrongIndex:1,wrong:"行政長官退回法案冇指定程序"},
  "articles-54-65": {wrongIndex:2,wrong:"律政司主管刑事檢控並受行政機關干涉"},
  "articles-66-71": {wrongIndex:1,wrong:"立法會組成同產生辦法可不受《基本法》規限"},
  "articles-72-79": {wrongIndex:1,wrong:"立法會法定人數只按出席議員計算"},
  "articles-80-96": {wrongIndex:1,wrong:"終審權屬中央人民政府"},
  "articles-97-104": {wrongIndex:0,wrong:"區域組織屬政權性組織"},
  "articles-105-113": {wrongIndex:1,wrong:"香港特區收入需要上繳中央"},
  "articles-114-127": {wrongIndex:1,wrong:"香港係中國境內普通關稅地區"},
  "articles-128-135": {wrongIndex:2,wrong:"香港特區可毋須中央授權自行簽發民航牌照"},
  "articles-136-149": {wrongIndex:1,wrong:"院校自主同學術自由不受保障"},
  "articles-150-157": {wrongIndex:1,wrong:"香港特區只可以香港名義發展對外關係"},
  "articles-158-160": {wrongIndex:1,wrong:"《基本法》修改權屬香港立法會"},
  "annexes": {wrongIndex:2,wrong:"附件三處理立法會產生同表決程序"},
  "nsl-articles-1-6": {wrongIndex:0,wrong:"維護國家安全只係香港特區嘅責任"},
  "nsl-articles-7-19": {wrongIndex:1,wrong:"香港國安委只提供一般政策意見"},
  "nsl-articles-20-30": {wrongIndex:1,wrong:"所有四類危害國家安全罪行都必須涉及武力"},
  "nsl-articles-31-47": {wrongIndex:0,wrong:"法人唔會負危害國家安全罪行嘅刑事責任"},
  "nsl-articles-48-66": {wrongIndex:1,wrong:"駐港國安公署可以自行管轄所有國安案件"},
};

const lessonIntroBySlug = {
  "exam-map": [
    "呢課先講清楚<b> BLNST 雙語選擇題</b>點樣問：每題只有一個正確答案，題幹可能要求揀「正確」或「不正確」嘅陳述。",
    "你會用<b>問題要求、法律主體、條文限制</b>三層去判斷選項；遇到數字、期限同程序，就返去官方條文核對。",
  ],
  "preamble-articles-1-5": [
    "今課會讀<b>《基本法》序言及第 1–5 條</b>，掌握香港係中國不可分離嘅部分，以及香港特別行政區點樣根據憲法同《基本法》成立。",
    "重點係<b>高度自治源自全國人大授權</b>，香港享有行政管理權、立法權、獨立司法權同終審權；原有資本主義制度同生活方式保持五十年不變。",
  ],
  "articles-6-11": [
    "今課會讀<b>《基本法》第 6–11 條</b>：香港特區<b>依法保障私人同法人財產</b>；除原有依法屬新界鄉村集體所有嘅土地外，<b>土地同自然資源屬國家所有</b>，由特區政府管理、使用、開發、出租或批出。",
    "你亦會掌握<b>原有法律點樣保留</b>、中英文嘅官方語文地位、區旗同區徽嘅法定式樣，以及<b>所有香港法律都唔可以牴觸《基本法》</b>。",
  ],
  "articles-12-18": [
    "今課會讀<b>《基本法》第 12–18 條</b>，分清香港係直轄中央人民政府、享有高度自治權嘅地方行政區域，而<b>外交同防務由中央人民政府負責</b>。",
    "你亦會理解中央任命主要官員、特區自行制定法律、全國人大常委會審查特區法律，以及<b>附件三全國性法律點樣喺香港實施</b>。",
  ],
  "articles-19-23": [
    "今課會讀<b>《基本法》第 19–23 條</b>，掌握香港法院享有<b>獨立審判權同終審權</b>，以及特區可以按《基本法》獲授予其他權力。",
    "你亦會分清中央人民政府所屬各部門、各省、自治區同直轄市，不得干預<b>香港特區根據《基本法》自行管理嘅事務</b>；香港特區亦須按第 23 條自行立法。",
  ],
  "articles-24-26": [
    "今課會讀<b>《基本法》第 24–26 條</b>，分辨香港永久性居民同非永久性居民，並掌握邊類人士依法享有香港居留權。",
    "核心原則係<b>香港居民喺法律面前一律平等</b>，而香港永久性居民依法享有<b>選舉權同被選舉權</b>。",
  ],
  "articles-27-32": [
    "今課會讀<b>《基本法》第 27–32 條</b>，認識言論、新聞、出版、結社、集會、遊行、示威、組織工會同罷工等<b>基本自由</b>。",
    "你亦會掌握<b>人身自由、住宅、通訊、遷徙、良心同宗教信仰</b>點樣受保障，以及任何搜查、拘捕或限制都必須有法律依據。",
  ],
  "articles-33-39": [
    "今課會讀<b>《基本法》第 33–39 條</b>，涵蓋選擇職業、學術研究、文學藝術創作、婚姻家庭、社會福利同依法尋求法律補救等權利。",
    "重要底線係原來適用香港嘅<b>《公民權利和政治權利國際公約》同《經濟、社會與文化權利的國際公約》</b>相關規定繼續有效，並透過香港法律實施。",
  ],
  "articles-40-42": [
    "今課會讀<b>《基本法》第 40–42 條</b>，掌握<b>新界原居民嘅合法傳統權益</b>受香港特區保護。",
    "你亦會理解非香港居民依法享有本章規定嘅權利同自由，而所有香港居民都有<b>遵守香港法律</b>嘅義務。",
  ],
  "articles-43-47": [
    "今課會讀<b>《基本法》第 43–47 條</b>，掌握行政長官係香港特區首長、代表香港特區，並同時向中央人民政府同香港特區負責。",
    "你亦會認識<b>行政長官嘅資格、產生及任命</b>、五年任期同連任限制，以及就任時必須宣誓、廉潔奉公同盡忠職守。",
  ],
  "articles-48-53": [
    "今課會讀<b>《基本法》第 48–53 條</b>，逐項認識行政長官領導政府、簽署法案同預算、決定政策、任免官員等<b>法定職權</b>。",
    "你亦會掌握行政長官退回法案、解散立法會、必須辭職同暫時不能履行職務時嘅<b>法定條件及程序</b>。",
  ],
  "articles-54-65": [
    "今課會讀<b>《基本法》第 54–65 條</b>，分清行政會議點樣協助行政長官決策，以及香港特區政府作為行政機關嘅組成同職權。",
    "重點包括<b>主要官員嘅資格與任命</b>、政府向立法會負責嘅方式，以及律政司主管刑事檢控、<b>不受任何干涉</b>。",
  ],
  "articles-66-71": [
    "今課會讀<b>《基本法》第 66–71 條</b>，掌握立法會係香港特區嘅立法機關，以及議員嘅組成、產生辦法、任期同議席出缺安排。",
    "你亦會認識<b>立法會主席嘅資格、產生方法同職權</b>，避免將主席權力同立法會整體權力混為一談。",
  ],
  "articles-72-79": [
    "今課會讀<b>《基本法》第 72–79 條</b>，分清立法會主席、立法會同個別議員各自擁有嘅權力，包括制定法律、審批預算、質詢同辯論公共利益事項。",
    "你亦會掌握<b>政府法案同議員法案嘅程序</b>、法定人數、議員言論及表決保障，以及議員喪失資格嘅法定情況。",
  ],
  "articles-80-96": [
    "今課會讀<b>《基本法》第 80–96 條</b>，認識香港各級法院嘅架構，並掌握法院依法<b>獨立進行審判同享有終審權</b>。",
    "你亦會理解法官任免及免職程序、審判原則、陪審制度、法律專業，同香港同內地司法機關之間嘅<b>司法協助安排</b>。",
  ],
  "articles-97-104": [
    "今課會讀<b>《基本法》第 97–104 條</b>，理解區域組織屬非政權性組織，並認識香港原有公務人員制度點樣原則上保留。",
    "重點包括<b>公務人員嘅聘用、薪酬、服務條件同本地化原則</b>，以及行政長官、主要官員、司法人員同立法會議員等指定公職人員嘅<b>宣誓要求</b>。",
  ],
  "articles-105-113": [
    "今課會讀<b>《基本法》第 105–113 條</b>，掌握依法保障財產權、香港特區保持財政獨立兼財政收入不上繳中央、量入為出、保持低稅政策，同中央唔會喺香港徵稅。",
    "你亦會理解<b>港元作為法定貨幣</b>、自由兌換、外匯基金由特區政府管理，以及香港不實行外匯管制等金融制度。",
  ],
  "articles-114-127": [
    "今課會讀<b>《基本法》第 114–127 條</b>，掌握香港保持自由港、實行自由貿易政策，並以<b>「中國香港」名義作為單獨關稅地區</b>參與相關國際安排。",
    "你亦會認識工商業、專業制度、航運政策同船舶登記安排，以及香港保持<b>國際航運中心</b>地位嘅法律基礎。",
  ],
  "articles-128-135": [
    "今課會讀<b>《基本法》第 128–135 條</b>，理解香港保持國際同區域航空中心地位，並繼續實行原有嘅民用航空管理制度。",
    "重點係分清中央同特區喺<b>航空運輸協定、航線同航空公司牌照</b>方面嘅權責，以及香港可以按中央授權處理嘅對外航空事務。",
  ],
  "articles-136-149": [
    "今課會讀<b>《基本法》第 136–149 條</b>，掌握香港自行制定教育、科學、文化、體育、醫療衞生、社會福利同專業制度等政策。",
    "你亦會理解<b>院校自主、學術自由、宗教自由</b>，以及民間團體、宗教組織同專業團體依法維持活動及對外交流嘅保障。",
  ],
  "articles-150-157": [
    "今課會讀<b>《基本法》第 150–157 條</b>，認識香港點樣參與中央進行嘅相關外交談判，並以<b>「中國香港」名義</b>維持同發展對外關係。",
    "你亦會掌握香港參加國際組織、簽訂協議、簽發旅行證件、出入境管制，以及外國領事機構同官方或半官方機構嘅<b>設立安排</b>。",
  ],
  "articles-158-160": [
    "今課會讀<b>《基本法》第 158–160 條</b>，掌握《基本法》解釋權屬全國人大常委會，而香港法院可以喺審理案件時解釋自治範圍內嘅條款。",
    "你亦會理解涉及中央管理事務或中央同香港關係條款時嘅<b>提請解釋程序</b>、《基本法》修改權同提案權，以及原有法律點樣獲確認繼續採用。",
  ],
  "annexes": [
    "今課會讀<b>《基本法》附件一至三</b>：附件一規定行政長官產生辦法，附件二規定立法會產生辦法同表決程序。",
    "附件三列明喺香港實施嘅<b>全國性法律</b>，由香港公布或立法實施；你亦會核對相關全國人大及全國人大常委會決定，避免沿用過時名單或數字。",
  ],
  "nsl-articles-1-6": [
    "今課會讀<b>《香港國安法》第 1–6 條</b>，掌握立法目的、維護國家安全係中央同香港特區共同責任，以及香港應當依法防範、制止同懲治危害國家安全行為。",
    "重要原則包括<b>尊重同保障人權、罪刑法定、無罪推定同不具追溯力</b>，以及參選或就任公職時擁護《基本法》同效忠香港特區嘅要求。",
  ],
  "nsl-articles-7-19": [
    "今課會讀<b>《香港國安法》第 7–19 條</b>，認識香港特區完善維護國家安全法律同執行機制、加強國安教育及定期向中央提交報告嘅責任。",
    "你亦會掌握<b>香港特區維護國家安全委員會</b>、警務處國安部門、律政司專門檢控部門同國家安全事務顧問各自嘅組成、職責同運作安排。",
  ],
  "nsl-articles-20-30": [
    "今課會讀<b>《香港國安法》第 20–30 條</b>，分清分裂國家、顛覆國家政權、恐怖活動，同勾結外國或境外勢力危害國家安全四類罪行。",
    "每類罪行都有<b>獨立嘅構成要件同刑罰分級</b>；答題時要核對行為、目的、手段同參與程度，唔可以只憑相似字眼判斷。",
  ],
  "nsl-articles-31-47": [
    "今課會讀<b>《香港國安法》第 31–47 條</b>，掌握法人刑責、從輕處罰情況、法律效力範圍、案件管轄，同犯罪得益及參選資格等後果。",
    "你亦會認識國安案件嘅<b>立案偵查、檢控、保釋、指定法官、陪審團同證明書</b>等特別程序，以及相關決定由邊個機關作出。",
  ],
  "nsl-articles-48-66": [
    "今課會讀<b>《香港國安法》第 48–66 條</b>，認識中央人民政府駐香港特區維護國家安全公署嘅職責、監督安排同法律保障。",
    "重點包括公署喺法定特殊情況下行使管轄權嘅<b>第 55 條機制</b>、《香港國安法》同香港本地法律不一致時嘅適用次序，以及<b>解釋權屬全國人大常委會</b>。",
  ],
};

const plainMeaningByKey = {
  "先讀否定詞":"先睇清楚題目係問『正確』定『不正確』。",
  "再鎖定權力主體":"確認條文講緊邊個機關、人物或政府層級。",
  "最後核對數字與程序":"最後先對年期、比例、適用範圍同法定程序。",
  "香港係中國不可分離部分":"香港屬於中國，唔係獨立國家。",
  "高度自治源自全國人大授權":"香港嘅高度自治權係全國人大透過《基本法》授予。",
  "原有制度按《基本法》維持":"香港原有資本主義制度同生活方式五十年不變。",
  "香港依法保障私人及法人財產":"香港特區依法保障私人同法人嘅財產。",
  "土地及自然資源屬國家所有":"土地同自然資源屬國家，由香港特區依法管理及使用。",
  "原有法律原則上保留":"原有法律除咗抵觸《基本法》或經修改之外，繼續適用。",
  "香港直轄中央人民政府":"「直轄」即係香港直接隸屬中央人民政府，唔隸屬任何省、自治區或直轄市；香港同時按《基本法》享有高度自治。",
  "香港特區外交與防務由中央人民政府負責":"中央人民政府負責管理同香港特區有關嘅外交事務及香港特區防務。",
  "附件三全國性法律在香港公布或立法實施":"列入《基本法》附件三嘅全國性法律，由香港特區公布或立法實施。",
  "香港法院依法獨立審判":"香港法院依法獨立審判，不受任何干涉。",
  "中央各部門等不得干預香港特區自行管理嘅事務":"中央人民政府所屬各部門、各省、自治區同直轄市，不得干預香港特區根據《基本法》自行管理嘅事務。",
  "香港特區須按《基本法》第 23 條自行立法":"香港特區要自行立法禁止《基本法》第 23 條列明嘅危害國家安全行為。",
  "居民包括永久及非永久居民":"永久居民同非永久居民都屬於香港居民。",
  "居民在法律面前一律平等":"所有香港居民喺法律面前都係平等。",
  "永久居民依法享有選舉權":"香港永久居民依法享有選舉權同被選舉權。",
  "多項基本自由受保障":"言論、新聞、出版、結社同集會等自由受保障。",
  "人身自由不受侵犯":"唔可以任意或非法拘捕、拘留或監禁香港居民。",
  "通訊自由受法律保護":"通訊秘密受保障；只可以喺法律訂明情況下檢查。",
  "居民有選擇職業自由":"香港居民可以自由選擇職業。",
  "香港居民有權獲保密法律諮詢":"香港居民可獲保密法律意見、向法院提訴同選擇律師。",
  "兩項人權國際公約原適用香港嘅規定繼續有效":"《公民權利和政治權利國際公約》同《經濟、社會與文化權利的國際公約》原適用香港嘅規定繼續有效。",
  "原居民合法傳統權益受保護":"新界原居民嘅合法傳統權益受香港特區保護。",
  "非居民依法享有本章權利自由":"香港居民以外嘅人，依法享有本章列明嘅權利同自由。",
  "居民有遵守法律義務":"居民享有權利，同時亦有遵守香港法律嘅義務。",
  "行政長官代表香港特區":"行政長官係香港特區首長，代表香港特區。",
  "行政長官由中央人民政府任命":"行政長官喺香港特區產生後，由中央人民政府任命。",
  "行政長官須廉潔奉公及盡忠職守":"行政長官就任時要依法宣誓，廉潔奉公同盡忠職守。",
  "行政長官法定職權要逐項核對":"答題時要分清楚邊一項先係行政長官嘅法定職權。",
  "行政長官退回法案有指定程序":"行政長官退回法案、立法會再次通過同解散立法會都有指定程序。",
  "行政長官在法定情況下必須辭職":"《基本法》第 52 條列明三種行政長官必須辭職嘅情況。",
  "行政會議協助行政長官決策":"行政會議協助行政長官作出政策決定。",
  "香港特區政府係行政機關":"香港特區政府係香港特區嘅行政機關。",
  "律政司主管刑事檢控並不受干涉":"律政司主管刑事檢控工作，不受任何干涉。",
  "立法會係立法機關":"立法會係香港特區嘅立法機關。",
  "立法會組成與產生辦法受《基本法》規限":"立法會組成同產生辦法要跟《基本法》及附件規定。",
  "立法會主席有特定資格要求":"立法會主席要符合永久居民、通常居港同國籍等資格。",
  "主席、立法會、議員職權要分清":"立法會主席、立法會整體同個別議員各有唔同法定職權。",
  "立法會法定人數以全體議員計":"立法會開會法定人數不得少於全體議員二分之一。",
  "議員言論及表決受保障":"議員喺立法會會議中嘅發言同表決不受法律追究。",
  "香港法院獨立進行審判":"香港法院依法獨立進行審判，不受任何干涉。",
  "終審權屬香港特區":"香港特區享有終審權，終審法院係最高上訴法院。",
  "香港法官任免有指定程序":"香港法官任免要跟獨立委員會推薦等法定程序。",
  "區域組織屬非政權性":"區域組織提供服務同接受諮詢，但唔係政權機關。",
  "公務制度原則上保留":"原有公務人員招聘、薪酬同服務條件等制度原則上保留。",
  "指定公職人員須依法宣誓":"行政長官、主要官員、議員同法官等指定人員要依法宣誓。",
  "香港依法保障私人及法人財產權":"私人同法人財產嘅取得、使用、處置、繼承同徵用補償權利都受法律保障。",
  "香港特區保持財政獨立，收入不上繳中央":"香港特區財政收入全部用於自身需要，唔上繳中央人民政府；中央亦唔喺香港徵稅。",
  "外匯基金由特區政府管理":"外匯基金由特區政府管理，主要用嚟調節港元匯價。",
  "香港保持自由港地位":"香港繼續係自由港，除法律另有規定外唔徵關稅。",
  "香港係單獨關稅地區":"香港保持單獨關稅地區地位，可用『中國香港』名義參與相關組織。",
  "船舶可用中國香港名義登記":"香港船舶可以按香港法律用『中國香港』名義登記。",
  "香港特區自行負責民航日常及技術管理":"香港特區自行負責機場管理、空中交通服務等民航日常業務同技術管理。",
  "指定民用航空協定由中央人民政府簽訂":"涉及中國其他地區、外國或其他地區並按第 132 條所述經停香港嘅民用航空協定，由中央人民政府簽訂。",
  "香港特區政府可按中央授權簽發民航牌照":"中央人民政府授權香港特區政府向合資格航空公司簽發執照或許可證。",
  "香港自行制定多項社會政策":"香港可自行制定教育、科技、文化、體育同勞工等政策。",
  "院校保留自主與學術自由":"各類院校可保留自主性，學術自由受保障。",
  "宗教組織依法維持活動":"宗教組織可依法維持活動、辦學同提供社會服務。",
  "香港特區代表可參加直接影響香港嘅外交談判":"中央進行直接影響香港特區嘅外交談判時，香港特區政府代表可作為中國政府代表團成員參加。",
  "香港特區可用中國香港名義發展對外關係":"香港特區可用『中國香港』名義發展對外關係同簽訂協議。",
  "外國在香港設立領事機構須經中央批准":"外國喺香港設立領事機構，要經中央人民政府批准。",
  "《基本法》解釋權屬全國人大常委會":"《基本法》解釋權屬全國人大常委會。",
  "《基本法》修改權屬全國人大":"只有全國人民代表大會有權修改《基本法》。",
  "香港原有法律除被宣布抵觸《基本法》外予以採用":"香港原有法律，除咗全國人大常委會宣布抵觸《基本法》嘅部分之外，採用為香港特區法律。",
  "附件一處理行政長官產生辦法":"附件一講行政長官點樣產生。",
  "附件二處理立法會產生與表決":"附件二講立法會點樣產生同點樣表決法案議案。",
  "附件三列明在港實施全國性法律":"附件三列出喺香港實施嘅全國性法律。",
  "中央對香港國安負根本責任，香港特區負憲制責任":"中央人民政府對香港特區有關國家安全事務負根本責任；香港特區負有維護國家安全嘅憲制責任。",
  "《香港國安法》保障人權並採用無罪推定":"維護國安同時要依法尊重同保障人權；未經司法機關判罪之前推定無罪。",
  "參選或就任公職須擁護《基本法》及效忠香港特區":"香港居民參選或就任公職時，要依法確認擁護《基本法》同效忠香港特區。",
  "香港特區須完善維護國安法律及執行機制":"香港特區要盡早完成維護國安立法，完善相關法律同執行機制。",
  "香港國安委負責香港維護國家安全事務":"香港國安委負責香港特區維護國家安全事務，承擔主要責任。",
  "警務處及律政司設專責部門":"警務處同律政司分別設立處理國安工作嘅專責部門。",
  "四類罪行構成要件各有不同":"分裂國家、顛覆、恐怖活動同勾結外國勢力，各有唔同構成條件。",
  "武力並非所有罪行必要條件":"唔係每一項國安罪都一定要使用武力先成立。",
  "唔可以用相似字眼互換罪名":"遇到相似字眼，要按條文逐項對應罪名，唔好混淆。",
  "法人亦可能負刑事責任":"公司等法人或組織都可能觸犯國安罪並受處罰。",
  "《香港國安法》適用於條文指定嘅境外行為":"《香港國安法》第 36–38 條列明部分香港以外發生嘅行為都受本法適用。",
  "國安案件嘅管轄、保釋及審訊有特別程序":"國安案件嘅管轄、保釋同審訊等有特別程序。",
  "駐港國安公署有法定職責":"駐港國安公署依法履行分析研判、監督、指導、協調同辦案等職責。",
  "駐港國安公署只可按第 55 條管轄特定案件":"只有符合《香港國安法》第 55 條指定情況，駐港國安公署先對案件行使管轄權。",
  "《香港國安法》解釋權屬全國人大常委會":"《香港國安法》嘅解釋權屬全國人大常委會。",
};

for (const def of lessonDefs) {
  for (const key of def.keys) if (!plainMeaningByKey[key]) throw new Error(`Missing plain-language meaning for: ${key}`);
}

function pagesFromOcr(text) {
  return new Map([...text.matchAll(/===== Page (\d+) =====\n([\s\S]*?)(?=\n===== Page|$)/g)].map((match) => [Number(match[1]), match[2]]));
}

const groupStarts = [
  ...[85,89,95,100,106,112,117,122,127,131,137,144,149,155].map((page,index,list)=>({domain:"basic-law",page,end:(list[index+1]??161)-1,count:15,set:index+1})),
  ...[163,167,171,175,180,184,189,193,198,203].map((page,index,list)=>({domain:"nsl",page,end:(list[index+1]??208)-1,count:10,set:index+1})),
];

function extractAnswerKey(raw, count, overrides = {}) {
  const marker = raw.search(/(?:重點)?練習[^\n]{0,14}答案/);
  const answerText = marker >= 0 ? raw.slice(marker) : raw;
  const pairs = [...answerText.matchAll(/(?:^|\n)\s*(\d{1,2})\s*[.．]\s*([A-Da-d0])(?=\s|$)/g)];
  const result = Array(count).fill(null);
  for (const match of pairs) {
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < count) result[index] = match[2] === "0" ? "D" : match[2].toUpperCase();
  }
  for (const [number,letter] of Object.entries(overrides)) result[Number(number)-1]=letter;
  if (result.some((item) => !item)) throw new Error(`Incomplete answer key: ${result.join(",")}`);
  return result;
}

function extractQuestionChunks(raw, count) {
  const marker = raw.search(/(?:重點)?練習[^\n]{0,14}答案/);
  let body = marker >= 0 ? raw.slice(0, marker) : raw;
  body = body
    .replace(/^.*(?:投考公務員|題解 ?EASY ?PASS|基本法測試|PART.{0,18}重點試題).*$/gm, "")
    .replace(/^\s*重點練習[^\n]*$/gm, "")
    .replace(/^\s*\d{1,3}\s*$/gm, "")
    .replace(/([\u3400-\u9fff）》」])([A-D])[.．]\s*/g, "$1\n$2. ")
    .replace(/^維護香港特別行政區穩定和守法意識/gm, "C. 維護香港特別行政區穩定和守法意識")
    .replace(/^\s*([A-D])[.．]\s*/gm, (_all,letter)=>`\n${letter}. `);
  const aPositions = [...body.matchAll(/^A\. /gm)].map((match) => match.index);
  if (aPositions.length !== count) throw new Error(`Expected ${count} question option groups, found ${aPositions.length}`);
  const starts = aPositions.map((aPosition, index) => {
    const from = index ? aPositions[index - 1] + 3 : 0;
    const broadRegion = body.slice(from, aPosition);
    const lastOptionD = broadRegion.lastIndexOf("\nD. ");
    const searchOffset = index && lastOptionD >= 0 ? lastOptionD + 4 : 0;
    const region = broadRegion.slice(searchOffset);
    const candidates = [...region.matchAll(/(?:^|\n)\s*(?:\d{1,2}[.．]\s*|(?=根據))/g)];
    return from + searchOffset + (candidates.at(-1)?.index ?? 0);
  });
  return starts.map((start,index)=>body.slice(start,starts[index+1]??body.length).trim());
}

function parseQuestion(chunk, answer, meta) {
  const markers = [...chunk.matchAll(/^([A-D])\. /gm)];
  if (markers.length !== 4) throw new Error(`Question ${meta.domain}-${meta.set}-${meta.number} has ${markers.length} options: ${chunk.slice(0,500)}`);
  const questionZh = clean(chunk.slice(0,markers[0].index).replace(/^\s*\d{1,2}\s*[.．]?\s*/, ""));
  const optionsZh = markers.map((marker,index)=>clean(chunk.slice(marker.index + marker[0].length,markers[index+1]?.index??chunk.length)));
  const articleMatch = questionZh.match(/第([零〇一二三四五六七八九十百\d]+)條/);
  const article = articleMatch ? chineseNumber(articleMatch[1]) : null;
  return {
    id: `${meta.domain === "basic-law" ? "bl" : "nsl"}-${String(meta.set).padStart(2,"0")}-${String(meta.number).padStart(2,"0")}`,
    domain: meta.domain,
    sourcePage: meta.page,
    sourceSet: meta.set,
    sourceQuestion: meta.number,
    article,
    questionZh,
    questionEn: "",
    options: optionsZh.map((labelZh,index)=>({id:String.fromCharCode(65+index),labelZh,labelEn:""})),
    correctOptionId: answer,
    explanationZh: "",
    trapZh: null,
    trapType: /不是|並不|不可以|除外|沒有/.test(questionZh) ? "negative-wording" : /多久|多少|比例|年|月|日/.test(questionZh) ? "numbers" : /由誰|哪位|機構|負責|任命/.test(questionZh) ? "authority" : "wording",
    difficulty: questionZh.length > 150 ? "hard" : questionZh.length > 80 ? "medium" : "easy",
    referenceIds: [],
    officialSource: "",
    verificationStatus: "manual-review-required",
  };
}

function cleanOcrArtifact(value) {
  return clean(String(value??"")
    .replace(/\s*(?:(?:[\p{Script=Han}A-Z]{0,2}解\s*)?EASY|[A-Z]{1,3})\s+PAS\S*.*$/giu,"")
    .replace(/題解\s*EASY\s*PASS[！!]?/gi,"")
    .replace(/自解\s*EASY\s*PAS[！!]?/gi,"")
    .replace(/領解\s*EASY\s*PASS/gi,"")
    .replace(/基本法[測测]試/g,""));
}

function cleanEnglishOcrArtifact(value) {
  return String(value??"").replace(/\s*(?:(?:Understanding|E solution|Self-explanation)\s+)?EASY\s+PAS\S*.*$/i,"").replace(/\s+[A-Z]{1,3}\s+PAS\S*.*$/i,"").trim();
}

function applyQuestionAudit(questions,audit) {
  const records=audit?.questions??{};
  const forbidden=[
    "先對照《基本法》",
    "先對照《香港國安法》",
    "先圈起「不是／不可以」",
    "主體、權力、數字同程序",
    "由此可見，題目所問嘅正確結論係",
    "所以正確選項係",
    "其他選項會改變條文原意",
    "題目問嘅係排除項，所以要揀",
  ];
  if(Object.keys(records).length!==questions.length)throw new Error(`Question audit has ${Object.keys(records).length} records for ${questions.length} questions`);
  return questions.map((source)=>{
    const record=records[source.id];
    if(!record)throw new Error(`Missing reviewed content for ${source.id}`);
    const merged={...source,...record};
    merged.questionZh=normalizeQuestionBlanks(cleanOcrArtifact(merged.questionZh));
    merged.questionEn=normalizeQuestionBlanks(cleanEnglishOcrArtifact(merged.questionEn));
    merged.options=merged.options.map((option)=>({...option,labelZh:cleanOcrArtifact(option.labelZh),labelEn:cleanEnglishOcrArtifact(option.labelEn)}));
    merged.explanationZh=clean(merged.explanationZh);
    merged.trapZh=merged.trapZh==null?null:clean(merged.trapZh);
    if(!["verified-current","retired"].includes(merged.verificationStatus))throw new Error(`${source.id} has invalid verification status`);
    if(!merged.explanationZh||forbidden.some((text)=>merged.explanationZh.includes(text)))throw new Error(`${source.id} has missing or boilerplate explanation`);
    if(!Array.isArray(merged.referenceIds)||!merged.referenceIds.length)throw new Error(`${source.id} has no legal reference`);
    if(!/^https:\/\//.test(merged.officialSource))throw new Error(`${source.id} has no exact official source`);
    if(!merged.options.some((option)=>option.id===merged.correctOptionId))throw new Error(`${source.id} has invalid answer ${merged.correctOptionId}`);
    return merged;
  });
}

function cleanOfficialReferenceText(value) {
  return clean(value)
    .replace(/\s+第[一二三四五六七八九十百]+(?:章|節)[^。！？；]*$/u,"")
    .replace(/\s*基本法主頁上一頁下一頁\s*$/u,"")
    .replace(/\s*Index of Basic Law Prev Next\s*$/u,"");
}

function normalizeReferences(references) {
  const normalized=references.filter((reference)=>Number.isInteger(reference.article)).map((reference)=>({
    ...reference,
    id:`${reference.domain}-article-${reference.article}`,
    citationZh:clean(reference.citationZh),
    textZh:cleanOfficialReferenceText(reference.textZh),
    textEn:cleanOfficialReferenceText(reference.textEn),
    sourceUrl:reference.domain==="basic-law"
      ? `https://www.basiclaw.gov.hk/tc/basiclaw/chapter${basicLawChapter(reference.article)}.html`
      : nslOfficialPdf,
  }));
  const byId=new Map([...normalized,...supplementalReferences].map((reference)=>[reference.id,reference]));
  return [...byId.values()];
}

function ensureQuestionLawMentions(questions,references) {
  const byId=new Map(references.map((reference)=>[reference.id,reference]));
  return questions.map((question)=>{
    const reference=question.referenceIds.map((id)=>byId.get(id)).find(Boolean);
    const citationZh=reference?.citationZh??(question.domain==="nsl"?"《香港國安法》":"《基本法》");
    const citationEn=reference?.citationEn??(question.domain==="nsl"?"Hong Kong National Security Law":"Basic Law");
    const mentionsLawZh=question.domain==="nsl"?/(?:香港國安法|維護國家安全法)/u.test(question.questionZh):/基本法/u.test(question.questionZh);
    const mentionsLawEn=question.domain==="nsl"?/(?:National Security Law|Law of the People's Republic of China on Safeguarding National Security)/iu.test(question.questionEn):/Basic Law/iu.test(question.questionEn);
    return {
      ...question,
      questionZh:mentionsLawZh?question.questionZh:`根據${citationZh}，${question.questionZh}`,
      questionEn:mentionsLawEn?question.questionEn:`According to ${citationEn}, ${question.questionEn}`,
    };
  });
}

function canonicalChineseWithMap(value) {
  const chars=[];
  const positions=[];
  const normalized=String(value??"").replaceAll("扺","抵").replaceAll("兑","兌").replaceAll("特别","特別");
  for(let index=0;index<normalized.length;index++){
    if(/[\p{Script=Han}0-9]/u.test(normalized[index])){
      chars.push(normalized[index]);
      positions.push(index);
    }
  }
  return {text:chars.join(""),positions};
}

function longestCommonSubstring(a,b,aStart,aEnd,bStart,bEnd) {
  let previous=new Uint16Array(bEnd-bStart+1);
  let best={a:aStart,b:bStart,size:0};
  for(let aIndex=aStart;aIndex<aEnd;aIndex++){
    const current=new Uint16Array(bEnd-bStart+1);
    for(let offset=0;offset<bEnd-bStart;offset++){
      if(a[aIndex]!==b[bStart+offset])continue;
      current[offset+1]=previous[offset]+1;
      if(current[offset+1]>best.size)best={a:aIndex-current[offset+1]+1,b:bStart+offset-current[offset+1]+1,size:current[offset+1]};
    }
    previous=current;
  }
  return best;
}

function collectMatchingBlocks(a,b,aStart,aEnd,bStart,bEnd,blocks) {
  const match=longestCommonSubstring(a,b,aStart,aEnd,bStart,bEnd);
  if(!match.size)return;
  collectMatchingBlocks(a,b,aStart,match.a,bStart,match.b,blocks);
  blocks.push(match);
  collectMatchingBlocks(a,b,match.a+match.size,aEnd,match.b+match.size,bEnd,blocks);
}

function lcsLength(a,b) {
  let previous=new Uint16Array(b.length+1);
  for(let aIndex=0;aIndex<a.length;aIndex++){
    const current=new Uint16Array(b.length+1);
    for(let bIndex=0;bIndex<b.length;bIndex++)current[bIndex+1]=a[aIndex]===b[bIndex]?previous[bIndex]+1:Math.max(previous[bIndex+1],current[bIndex]);
    previous=current;
  }
  return previous[b.length];
}

function inferMissingBlankPositions(question,answer,evidence) {
  if(question.includes("_")||!answer)return [];
  const prefix=question.match(/^根據《[^》]+》[^，,：:]*[，,：:]\s*/u)?.[0]??"";
  const body=question.slice(prefix.length);
  const canonicalBody=canonicalChineseWithMap(body);
  const canonicalAnswer=canonicalChineseWithMap(answer).text;
  if(!canonicalBody.text||!canonicalAnswer)return [];
  let best=null;
  for(const source of evidence){
    const canonicalSource=canonicalChineseWithMap(source);
    if(!canonicalSource.text)continue;
    const blocks=[];
    collectMatchingBlocks(canonicalSource.text,canonicalBody.text,0,canonicalSource.text.length,0,canonicalBody.text.length,blocks);
    if(!blocks.length)continue;
    const merged=[];
    for(const block of blocks){
      const previous=merged.at(-1);
      if(previous&&previous.a+previous.size===block.a&&previous.b+previous.size===block.b)previous.size+=block.size;
      else merged.push({...block});
    }
    const gaps=[];
    const boundaries=[{a:0,b:0,size:0},...merged,{a:canonicalSource.text.length,b:canonicalBody.text.length,size:0}];
    for(let index=0;index<boundaries.length-1;index++){
      const left=boundaries[index];
      const right=boundaries[index+1];
      const sourceStart=left.a+left.size;
      const bodyStart=left.b+left.size;
      const missing=canonicalSource.text.slice(sourceStart,right.a);
      const bodyGap=canonicalBody.text.slice(bodyStart,right.b);
      if(!missing||bodyGap)continue;
      const shared=lcsLength(missing,canonicalAnswer);
      if(shared<2||shared/missing.length<0.4)continue;
      const previousSourcePosition=canonicalSource.positions[sourceStart-1];
      const missingSourcePosition=canonicalSource.positions[sourceStart];
      const separatorBefore=previousSourcePosition==null||missingSourcePosition==null?"":source.slice(previousSourcePosition+1,missingSourcePosition);
      gaps.push({at:bodyStart,missing,afterSeparator:/[，。；：！？、?!,.;:]/u.test(separatorBefore)});
    }
    if(!gaps.length)continue;
    const combined=gaps.map((gap)=>gap.missing).join("");
    const shared=lcsLength(combined,canonicalAnswer);
    const similarity=(2*shared)/(combined.length+canonicalAnswer.length);
    if(similarity<0.55||combined.length>canonicalAnswer.length*1.5||canonicalAnswer.length>combined.length*2.5)continue;
    const score=similarity*100+merged.reduce((total,block)=>total+block.size,0)/Math.max(canonicalBody.text.length,1);
    if(!best||score>best.score)best={score,positions:gaps.map((gap)=>({at:gap.at,afterSeparator:gap.afterSeparator}))};
  }
  if(!best)return [];
  const placements=new Map(best.positions.map((position)=>[position.at,position]));
  return [...placements.values()].map(({at:canonicalIndex,afterSeparator})=>{
    if(canonicalIndex<=0)return prefix.length+(canonicalBody.positions[0]??0);
    if(canonicalIndex>=canonicalBody.positions.length)return prefix.length+(canonicalBody.positions.at(-1)??-1)+1;
    return prefix.length+(afterSeparator?canonicalBody.positions[canonicalIndex]:canonicalBody.positions[canonicalIndex-1]+1);
  });
}

const explicitMissingBlankRepairs={
  "bl-01-01":["自然資源收入：","自然資源收入：__________"],
  "bl-02-15":["兩部分出席會議議員通過。","兩部分出席會議議員__________通過。"],
  "bl-09-01":["區徽中間為：","區徽中間為：__________"],
  "bl-09-06":["人身自由不受侵犯，規定：","人身自由不受侵犯，規定：__________"],
  "bl-09-11":["必須依法宣誓擁護：","必須依法宣誓擁護：__________"],
  "bl-09-15":["附件三的法律是：","附件三的法律是：__________"],
  "bl-11-01":["兩國政府簽署了，確認","兩國政府簽署了__________，確認"],
  "bl-11-04":["任何列入附件三的法律，限於有關 o","任何列入附件三的法律，限於有關__________。"],
  "bl-12-10":["必須依法宣誓擁護：","必須依法宣誓擁護：__________"],
  "nsl-03-09":["任命前須書面徵求的意見","任命前須書面徵求__________的意見"],
  "nsl-04-04":["註冊的船舶或者內實施","註冊的船舶或者__________內實施"],
  "nsl-04-10":["在香港特別行政區設立，依法履行","在香港特別行政區設立__________，依法履行"],
};

const explicitEnglishBlankRepairs={
  "bl-10-01":"According to Article 4 of the Basic Law, the Hong Kong Special Administrative Region shall safeguard the rights and freedoms of __________ in accordance with law.",
};

function restoreMissingQuestionBlanks(questions,references) {
  const referenceById=new Map(references.map((reference)=>[reference.id,reference]));
  let restored=0;
  const repaired=questions.map((question)=>{
    const explicitRepair=explicitMissingBlankRepairs[question.id];
    if(explicitRepair&&!question.questionZh.includes("_")){
      const questionZh=question.questionZh.replace(explicitRepair[0],explicitRepair[1]);
      if(questionZh===question.questionZh)throw new Error(`${question.id} explicit blank repair no longer matches its source text`);
      restored+=1;
      return {...question,questionZh,questionEn:explicitEnglishBlankRepairs[question.id]??question.questionEn};
    }
    const correct=question.options.find((option)=>option.id===question.correctOptionId);
    const quoted=[...question.explanationZh.matchAll(/「([^」]+)」/gu)].map((match)=>match[1]);
    const legalText=question.referenceIds.map((id)=>referenceById.get(id)?.textZh).filter(Boolean);
    const positions=inferMissingBlankPositions(question.questionZh,correct?.labelZh,[...quoted,...legalText]);
    if(!positions.length)return question;
    let questionZh=question.questionZh;
    for(const position of [...positions].sort((a,b)=>b-a))questionZh=`${questionZh.slice(0,position)}${QUESTION_BLANK}${questionZh.slice(position)}`;
    restored+=positions.length;
    return {...question,questionZh,questionEn:explicitEnglishBlankRepairs[question.id]??question.questionEn};
  });
  console.log(`restored ${restored} missing question blank markers`);
  return repaired;
}

const questionWordingOverrides={
  "bl-05-06":{
    questionZh:"根據《基本法》第 37 條，香港居民邊一項自由同權利受法律保護？",
    questionEn:"According to Basic Law Article 37, which freedom and right of Hong Kong residents are protected by law?",
    optionZh:"婚姻自由和自願生育的權利",
    optionEn:"Freedom of marriage and the right to raise a family freely",
  },
};

function applyQuestionWordingOverrides(questions) {
  return questions.map((question)=>{
    const override=questionWordingOverrides[question.id];
    if(!override)return question;
    return {
      ...question,
      questionZh:override.questionZh,
      questionEn:override.questionEn,
      options:question.options.map((option)=>option.id===question.correctOptionId
        ?{...option,labelZh:override.optionZh,labelEn:override.optionEn}
        :option),
    };
  });
}

async function translate(value) {
  if (!value) return "";
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "zh-TW");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", value);
  for (let attempt=0;attempt<4;attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
      const data = await response.json();
      return data[0].map((part)=>part[0]).join("").trim();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve)=>setTimeout(resolve,400*(attempt+1)));
    }
  }
}

async function mapConcurrent(items, limit, fn) {
  const output = Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return output;
}

async function translateQuestions(questions) {
  return mapConcurrent(questions,10,async(question)=>{
    const translated = await translate([question.questionZh,...question.options.map((option)=>option.labelZh)].join(" ||| "));
    let parts = translated.split(/\s*\|\|\|\s*/);
    if (parts.length !== 5||parts.some((part)=>!part.trim())) parts = await mapConcurrent([question.questionZh,...question.options.map((option)=>option.labelZh)],3,translate);
    return {...question,questionEn:parts[0],options:question.options.map((option,index)=>({...option,labelEn:parts[index+1]}))};
  });
}

async function fetchBasicLawReferences() {
  const references = [];
  for (const lang of ["tc","en"]) {
    const records = new Map();
    const pages = await Promise.all(Array.from({length:9},(_,index)=>fetch(`https://www.basiclaw.gov.hk/${lang}/basiclaw/chapter${index+1}.html`).then((response)=>response.text())));
    for (const html of pages) {
      const pattern = lang === "en" ? /<h2>Article\s+(\d+)<\/h2>([\s\S]*?)(?=<h2>Article\s+\d+<\/h2>|<\/main>|$)/g : /<h2>第([零〇一二三四五六七八九十百]+)條<\/h2>([\s\S]*?)(?=<h2>第[零〇一二三四五六七八九十百]+條<\/h2>|<\/main>|$)/g;
      for (const match of html.matchAll(pattern)) records.set(lang === "en" ? Number(match[1]) : chineseNumber(match[1]),stripHtml(match[2]));
    }
    for (const [article,text] of records) {
      let item = references.find((entry)=>entry.domain === "basic-law" && entry.article === article);
      if (!item) { item={domain:"basic-law",article,citationZh:`《基本法》第 ${article} 條`,citationEn:`Basic Law Article ${article}`,textZh:"",textEn:"",sourceUrl:`https://www.basiclaw.gov.hk/${lang}/basiclawtext/index.html`,verifiedAt}; references.push(item); }
      if (lang === "en") item.textEn=text; else item.textZh=text;
    }
  }
  if (references.filter((item)=>item.textZh&&item.textEn).length !== 160) throw new Error(`Official Basic Law extraction returned ${references.length} articles`);
  return references;
}

function extractNslReferences(pageMap) {
  let body="";for(let page=59;page<=82;page++)body+=`\n${pageMap.get(page)??""}`;
  body=body.replace(/^.*(?:投考公務員|題解 ?EASY ?PASS|基本法測試|PART.*國安法全文.*).*$/gm,"").replace(/^\s*\d{1,3}\s*$/gm,"");
  const matches=[...body.matchAll(/(?:^|\n)第([零〇一二三四五六七八九十百]+)條\s*([\s\S]*?)(?=\n第[零〇一二三四五六七八九十百]+條\s*|$)/g)];
  const byArticle=new Map();for(const match of matches){const article=chineseNumber(match[1]);if(article>=1&&article<=66&&!byArticle.has(article))byArticle.set(article,clean(match[2]));}
  if(byArticle.size!==66)throw new Error(`NSL extraction returned ${byArticle.size} articles`);
  return [...byArticle].map(([article,textZh])=>({domain:"nsl",article,citationZh:`《香港國安法》第 ${article} 條`,citationEn:`Hong Kong National Security Law Article ${article}`,textZh,textEn:"",sourceUrl:nslUrl,verifiedAt}));
}

function lessonForQuestion(question) {
  if (!question.article) return question.domain === "basic-law" ? lessonDefs[22] : lessonDefs[23];
  return lessonDefs.find((lesson)=>lesson.domain===question.domain&&lesson.articles.includes(question.article)) ?? lessonDefs.find((lesson)=>lesson.domain===question.domain);
}

function screen(id,order,presentation,interactionPolicy,blocks,title) { return {id,sourcePageId:id,order,type:blocks[0]?.type??"chunk",title,presentation,interactionPolicy,blocks}; }
function paragraph(id,text){return{id,type:"paragraph",text};}
function heading(id,text){return{id,type:"heading",level:2,text};}

function quizBlock(question, id) {
  return {id,type:"single-choice",question:`${question.questionZh}<br><small>${question.questionEn}</small>`,options:question.options.map((option)=>({id:option.id,label:`${option.labelZh}<br><small>${option.labelEn}</small>`,isCorrect:option.id===question.correctOptionId})),feedbackCorrect:{text:question.explanationZh},feedbackIncorrect:{text:`未中。${question.explanationZh}`}};
}

function legalExcerpt(text,maxLength=112) {
  const value=clean(String(text??"").replace(/#+/gu,"")).replace(/\s+(?:註[:：]|資料截至[:：]).*$/su,"");
  const sentence=value.match(/^.*?[。！？]/u)?.[0]??value;
  if(sentence.length<=maxLength)return sentence;
  const shortened=sentence.slice(0,maxLength);
  const boundary=Math.max(shortened.lastIndexOf("；"),shortened.lastIndexOf("，"));
  return `${shortened.slice(0,boundary>=42?boundary:maxLength-1).replace(/[，；\s]+$/u,"")}……`;
}

function lessonReferences(def,references) {
  if(def.slug==="annexes"){
    const annexIds=["basic-law-annex-1","basic-law-annex-2","basic-law-annex-3"];
    return annexIds.map((id)=>{
      const reference=references.find((item)=>item.id===id);
      if(!reference)throw new Error(`Missing official reference ${id}`);
      return reference;
    });
  }
  return def.articles.map((article)=>{
    const reference=references.find((item)=>item.domain===def.domain&&item.article===article);
    if(!reference)throw new Error(`Missing official ${def.domain} Article ${article} reference`);
    return reference;
  });
}

function referenceLabel(reference,index) {
  if(Number.isInteger(reference.article))return `第 ${reference.article} 條`;
  if(reference.id==="basic-law-annex-1")return "附件一";
  if(reference.id==="basic-law-annex-2")return "附件二";
  if(reference.id==="basic-law-annex-3")return "附件三";
  return `重點 ${index+1}`;
}

const legalFocusOverrides={
  "basic-law-annex-1":"行政長官由選舉委員會選出；選舉委員會共有一千五百人",
  "basic-law-annex-2":"附件二訂明立法會產生辦法同表決程序",
  "basic-law-annex-3":"附件三列明喺香港實施嘅全國性法律",
  "basic-law-article-2":"全國人大授權香港依《基本法》實行高度自治",
  "basic-law-article-5":"香港維持資本主義制度及生活方式五十年不變",
  "basic-law-article-7":"香港土地及自然資源屬國家，由特區管理",
  "basic-law-article-8":"香港原有普通法等法律原則上保留",
  "basic-law-article-9":"香港行政、立法及司法機關可使用中英文",
  "basic-law-article-11":"香港制度、政策及法律須以《基本法》為依據",
  "basic-law-article-17":"香港立法機關制定嘅法律須報人大常委會備案，而香港特區本身享有立法權",
  "basic-law-article-18":"香港適用《基本法》、原有法律及本地立法",
  "basic-law-article-19":"香港法院享有獨立司法權及終審權",
  "basic-law-article-20":"香港可獲全國人大、人大常委會及中央授予其他權力",
  "basic-law-article-21":"香港永久居民中國公民依法參與國家事務管理",
  "basic-law-article-22":"中央部門不得干預香港依法自行管理嘅事務",
  "basic-law-article-23":"香港須自行立法禁止危害國家安全行為",
  "basic-law-article-27":"香港居民享有言論、集會及結社等自由",
  "basic-law-article-32":"香港居民可公開傳教及舉行宗教活動，並享有信仰的自由",
  "basic-law-article-34":"居民享有學術研究同文化創作自由",
  "basic-law-article-35":"香港居民享有法律諮詢、訴訟及司法補救權",
  "basic-law-article-33":"居民可自由決定從事邊種職業，因為佢哋享有選擇職業自由",
  "basic-law-article-36":"勞工福利同退休保障受法律保護，香港居民亦依法享有社會福利",
  "basic-law-article-37":"婚姻自由同自願生育權受法律保護",
  "basic-law-article-38":"其他法定權利同自由亦受保障",
  "basic-law-article-39":"兩項人權公約等在香港嘅規定繼續有效",
  "basic-law-article-41":"香港境內非居民依法享有本章權利及自由",
  "basic-law-article-44":"行政長官須年滿四十歲、在港通常居住連續滿二十年，並在外國無居留權",
  "basic-law-article-48":"領導特區政府、簽署法案、決定政策同依法任免法官，都屬於行政長官嘅法定職權",
  "basic-law-article-49":"行政長官可在三個月內將法案發回立法會重議",
  "basic-law-article-50":"法案或預算僵局下行政長官可解散立法會",
  "basic-law-article-51":"立法會拒批預算時行政長官可申請臨時撥款",
  "basic-law-article-52":"行政長官因嚴重疾病或其他原因無力履行職務時必須辭職",
  "basic-law-article-53":"行政長官短期不能履職時由三位司長依次代理",
  "basic-law-article-55":"行政會議成員由行政長官委任",
  "basic-law-article-61":"主要官員須為無外國居留權嘅永久居民中國公民",
  "basic-law-article-62":"制定及執行政策、管理行政事務、編製預算同提出法案，都屬於香港特區政府嘅法定職權",
  "basic-law-article-64":"香港特區政府須守法並向立法會負責",
  "basic-law-article-68":"立法會產生辦法最終達至全部議員由普選產生，而立法會現由選舉產生",
  "basic-law-article-70":"立法會解散後須於三個月內重新選舉",
  "basic-law-article-72":"主持會議、決定議程同召開特別或緊急會議，都屬於立法會主席嘅法定職權",
  "basic-law-article-73":"制定法律、審批預算、批准稅收同質詢政府，都屬於立法會嘅法定職權",
  "basic-law-article-74":"立法會議員提出涉及政府政策嘅法案前，須取得行政長官書面同意",
  "basic-law-article-79":"議員無合理解釋而連續三個月缺席會議，會被宣告喪失議員資格",
  "basic-law-article-84":"香港法院依法審判並可參考普通法判例",
  "basic-law-article-85":"法院獨立審判，司法人員履職行為不受追究",
  "basic-law-article-88":"法官由行政長官按獨立委員會推薦任命",
  "basic-law-article-89":"法官只可因無力履職或行為不檢而被免職",
  "basic-law-article-90":"終審法院及高等法院首席法官須為永久居民中國公民，並在外國無居留權",
  "basic-law-article-92":"法官按司法及專業才能選用，亦可從普通法地區聘任",
  "basic-law-article-93":"香港原有法官及司法人員可予留用",
  "basic-law-article-94":"香港可規管本地及外來律師執業",
  "basic-law-article-95":"香港可與內地司法機關協商互助",
  "basic-law-article-97":"香港可設立非政權性區域組織",
  "basic-law-article-100":"原有公務人員可留任並保留年資",
  "basic-law-article-101":"政府可聘外籍公務員，主要官員除外",
  "basic-law-article-102":"退休公務員待遇不低於原有標準",
  "basic-law-article-103":"原有公務員管理制度原則上保留",
  "basic-law-article-104":"指定公職人員就職時須依法宣誓",
  "basic-law-article-105":"私人及法人財產權受法律保障",
  "basic-law-article-106":"香港財政收入全部用於自身需要，毋須上繳中央，並保持財政獨立",
  "basic-law-article-107":"香港財政預算須量入為出並力求收支平衡",
  "basic-law-article-116":"香港可用「中國香港」名義參與國際貿易安排，因為香港特區係單獨的關稅地區",
  "basic-law-article-119":"香港須制定政策促進工商業發展",
  "basic-law-article-120":"原有土地契約及相關權利受法律保障",
  "basic-law-article-121":"過渡期土地契約毋須補地價但須繳租",
  "basic-law-article-122":"合資格舊批約及丁屋地維持原租金",
  "basic-law-article-123":"到期而無續期權嘅土地契約由香港依法處理",
  "basic-law-article-125":"香港獲授權繼續辦理船舶登記",
  "basic-law-article-126":"外國軍艦進港須中央許可，其他船舶依法進出",
  "basic-law-article-129":"香港繼續實行原有民航管理制度",
  "basic-law-article-130":"香港自行負責民航日常及技術管理",
  "basic-law-article-131":"中央與香港磋商安排駐港航空公司",
  "basic-law-article-132":"指定跨境民航協定由中央政府簽訂",
  "basic-law-article-133":"香港經中央授權可商訂民航運輸協定",
  "basic-law-article-134":"香港獲授權簽發航空牌照及航班許可",
  "basic-law-article-135":"原有香港航空公司及民航業可繼續經營",
  "basic-law-article-136":"香港自行制定教育政策及管理教育",
  "basic-law-article-137":"院校可繼續招生、聘任教師同選用教材，並保留自主及學術自由",
  "basic-law-article-139":"香港自行制定科技政策並保障科研成果",
  "basic-law-article-140":"香港自行制定文化政策並保障創作成果",
  "basic-law-article-141":"宗教自由及宗教組織權益受保障",
  "basic-law-article-142":"香港保留專業制度並自行制定資格評審辦法",
  "basic-law-article-144":"原有民間團體資助政策原則上保留",
  "basic-law-article-145":"香港自行制定社會福利發展及改進政策",
  "basic-law-article-148":"香港與內地民間團體互不隸屬、互不干涉",
  "basic-law-article-149":"香港民間團體可同國際組織發展關係",
  "basic-law-article-150":"香港代表可參加直接影響香港嘅外交談判",
  "basic-law-article-151":"香港可以「中國香港」名義發展對外關係",
  "basic-law-article-152":"香港可按規定參與國際組織及會議",
  "basic-law-article-153":"國際協議是否適用香港按法定程序決定",
  "basic-law-article-154":"香港獲授權簽發特區護照及旅行證件",
  "basic-law-article-160":"香港原有法律除抵觸《基本法》外予以採用",
  "nsl-article-1":"國安法旨在維護國安及保障香港繁榮穩定",
  "nsl-article-2":"任何機構、組織或個人行使權利自由時，都不得違背《基本法》第1及12條",
  "nsl-article-4":"維護國家安全時須尊重和保障人權",
  "nsl-article-8":"香港執法及司法機關須執行國安法",
  "nsl-article-10":"香港須透過學校、媒體等推行國安教育",
  "nsl-article-11":"行政長官須就香港國安事務向中央負責",
  "nsl-article-12":"香港設立維護國家安全委員會",
  "nsl-article-13":"香港國安委由行政長官擔任主席",
  "nsl-article-14":"香港國安委負責研判國安形勢、制定政策同協調重大行動，而佢作出嘅決定不受司法覆核",
  "nsl-article-15":"國安委設中央政府指派嘅國安事務顧問",
  "nsl-article-17":"收集國安情報、調查危害國安犯罪同進行反干預調查，都屬於警務處國安部門嘅法定職責",
  "nsl-article-18":"律政司設專門國安案件檢控部門",
  "nsl-article-19":"財政司長須為國安工作撥出專門款項",
  "nsl-article-20":"分裂國家行為不論有否使用武力均屬犯罪",
  "nsl-article-21":"煽動、協助或資助他人分裂國家即屬犯罪",
  "nsl-article-22":"以武力或非法手段顛覆國家政權即屬犯罪",
  "nsl-article-23":"煽動、協助或資助他人顛覆國家政權即屬犯罪",
  "nsl-article-24":"為政治主張實施恐怖活動即屬犯罪",
  "nsl-article-25":"組織或領導恐怖活動組織屬犯罪，最高可判無期徒刑",
  "nsl-article-26":"支援、協助或準備恐怖活動即屬犯罪",
  "nsl-article-28":"其他恐怖活動仍可按香港法律追究及凍結財產",
  "nsl-article-29":"勾結外國或境外勢力危害國安即屬犯罪",
  "nsl-article-30":"獲境外支援實施分裂或顛覆罪會從重處罰",
  "nsl-article-32":"犯罪所得及犯罪工具須予追繳或沒收",
  "nsl-article-33":"自首、放棄犯罪或協助破案可獲從寬處罰",
  "nsl-article-34":"非永久居民犯國安罪可被驅逐出境",
  "nsl-article-35":"被判國安罪即喪失參選及出任公職資格",
  "nsl-article-37":"香港永久居民等境外犯罪亦適用國安法",
  "nsl-article-38":"非永久居民境外針對香港犯罪亦適用國安法",
  "nsl-article-41":"香港管轄國安案件並適用本地訴訟程序",
  "nsl-article-42":"國安案件須從速辦理並適用特別保釋門檻",
  "nsl-article-43":"警務處國安部門調查危害國安案件時，可搜查相關地方及凍結犯罪相關財產",
  "nsl-article-44":"行政長官指定處理國安案件嘅法官",
  "nsl-article-45":"國安案件原則上按香港其他法律處理",
  "nsl-article-46":"律政司長可依法指示國安案件無陪審團審理",
  "nsl-article-47":"國安或國家秘密認定須取得行政長官證明書",
  "nsl-article-49":"研判國安形勢、提出政策建議、收集情報同依法辦案，都屬於駐港國安公署嘅法定職責",
  "nsl-article-50":"國安公署須依法履職、受監督並保障合法權益",
  "nsl-article-52":"國安公署須加強與中央駐港機構協作",
  "nsl-article-53":"國安公署與香港國安委建立協調機制",
  "nsl-article-54":"加強對外國及境外駐港機構嘅管理和服務",
  "nsl-article-55":"特殊情況下國安公署經中央批准行使管轄權",
  "nsl-article-56":"國安公署管轄案件由指定國家機關辦理",
  "nsl-article-57":"國安公署管轄案件適用國家刑事訴訟法律",
  "nsl-article-58":"國安公署管轄案件保障律師及及時審判權",
  "nsl-article-59":"任何人對國安公署管轄案件有如實作證義務",
  "nsl-article-61":"香港政府須為國安公署履職提供便利配合",
  "nsl-article-63":"國安案件參與人員須依法保守相關秘密",
  "nsl-article-64":"國安法刑罰用語按香港法律對應解釋",
  "nsl-article-66":"國安法由全國人大常委會通過並列入《基本法》附件三，自公布之日起施行",
};

function legalFocusSummary(reference) {
  const override=legalFocusOverrides[reference.id];
  if(override)return override;
  const value=clean(String(reference.textZh??"").replace(/#+/gu,"")).replace(/\s+(?:註[:：]|資料截至[:：]).*$/su,"")
    .replaceAll("中華人民共和國香港特別行政區","香港特區")
    .replaceAll("香港特別行政區","香港特區")
    .replaceAll("中央人民政府","中央政府");
  const sentence=(value.match(/^.*?[。！？]/u)?.[0]??value).replace(/[。！？]+$/u,"");
  if(sentence.length>44)throw new Error(`Missing concise focus for ${reference.id} (${sentence.length} characters)`);
  return sentence;
}

function lessonLearningPoints(def,references) {
  if(def.slug==="exam-map")return def.keys;
  if(def.slug==="annexes")return def.keys.map((key)=>key.replace(/^(附件[一二三])(?=處理|列明)/u,"$1："));
  return references.map((reference,index)=>`${referenceLabel(reference,index)}：${legalFocusSummary(reference)}`);
}

function twoOptionQuizBlock(question,order,reference,id) {
  const correct=question.options.find((option)=>option.id===question.correctOptionId);
  const incorrect=question.options.find((option)=>option.id!==question.correctOptionId);
  if(!correct||!incorrect)throw new Error(`Question ${question.id} cannot be reduced to two options`);
  const ordered=order%2===1?[correct,incorrect]:[incorrect,correct];
  const correctIndex=ordered.indexOf(correct);
  const answerId=String.fromCharCode(65+correctIndex);
  const groundedExplanation=reference?`${reference.citationZh}訂明：「${reference.textZh}」`:question.explanationZh.replace(/^答案係 [A-D]。/u,"");
  const explanation=`答案係 ${answerId}。${groundedExplanation}`;
  return {
    id,
    type:"single-choice",
    question:`${question.questionZh}<br><small>${question.questionEn}</small>`,
    options:ordered.map((option,index)=>({id:String.fromCharCode(65+index),label:`${option.labelZh}<br><small>${option.labelEn}</small>`,isCorrect:index===correctIndex})),
    feedbackCorrect:{text:explanation},
    feedbackIncorrect:{text:`未中。${explanation}`},
  };
}

const clozeSuffixes=[
  "不可分離的部分",
  "實行高度自治",
  "受法律保護",
  "不受侵犯",
  "繼續有效",
  "即屬犯罪",
  "受保障",
];

const semanticClozeOverrides={
  "basic-law-article-3":"本法有關規定組成",
  "basic-law-article-4":"其他人的權利和自由",
  "basic-law-article-13":"有關的外交事務",
  "basic-law-article-14":"香港特區的防務",
  "basic-law-article-15":"行政機關的主要官員",
  "basic-law-article-16":"香港特區的行政事務",
  "basic-law-article-17":"立法權",
  "basic-law-article-32":"信仰的自由",
  "basic-law-article-33":"選擇職業自由",
  "basic-law-article-36":"社會福利",
  "basic-law-article-44":"在外國無居留權",
  "basic-law-article-24":"永久性居民和非永久性居民",
  "basic-law-article-25":"法律面前一律平等",
  "basic-law-article-48":"法定職權",
  "basic-law-article-49":"法案發回立法會重議",
  "basic-law-article-52":"辭職",
  "basic-law-article-62":"法定職權",
  "basic-law-article-68":"選舉產生",
  "basic-law-article-72":"法定職權",
  "basic-law-article-73":"法定職權",
  "basic-law-article-74":"行政長官書面同意",
  "basic-law-article-79":"喪失議員資格",
  "basic-law-article-82":"香港特區終審法院",
  "basic-law-article-88":"獨立委員會推薦任命",
  "basic-law-article-90":"在外國無居留權",
  "basic-law-article-107":"量入為出並力求收支平衡",
  "basic-law-article-106":"財政獨立",
  "basic-law-article-112":"外匯管制政策",
  "basic-law-article-116":"單獨的關稅地區",
  "basic-law-article-124":"有關海員的管理制度",
  "basic-law-article-125":"辦理船舶登記",
  "basic-law-article-128":"國際和區域航空中心的地位",
  "basic-law-article-137":"學術自由",
  "basic-law-article-138":"醫療衞生服務的政策",
  "basic-law-article-142":"制定資格評審辦法",
  "basic-law-article-143":"制定體育政策",
  "basic-law-article-144":"資助政策原則上保留",
  "basic-law-article-147":"有關勞工的法律和政策",
  "basic-law-article-151":"名義發展對外關係",
  "basic-law-article-153":"是否適用香港按法定程序決定",
  "basic-law-article-158":"全國人民代表大會常務委員會",
  "basic-law-article-159":"全國人民代表大會",
  "basic-law-article-160":"《基本法》外予以採用",
  "basic-law-annex-1":"一千五百人",
  "nsl-article-2":"不得違背《基本法》第1及12條",
  "nsl-article-9":"防範恐怖活動的工作",
  "nsl-article-14":"不受司法覆核",
  "nsl-article-17":"法定職責",
  "nsl-article-18":"案件檢控部門",
  "nsl-article-20":"不論有否使用武力均屬犯罪",
  "nsl-article-25":"無期徒刑",
  "nsl-article-30":"顛覆罪會從重處罰",
  "nsl-article-38":"犯罪亦適用國安法",
  "nsl-article-40":"本法第五十五條規定的情形除外",
  "nsl-article-42":"適用特別保釋門檻",
  "nsl-article-43":"凍結犯罪相關財產",
  "nsl-article-46":"案件無陪審團審理",
  "nsl-article-48":"維護國家安全公署",
  "nsl-article-49":"法定職責",
  "nsl-article-57":"國家刑事訴訟法律",
  "nsl-article-65":"全國人民代表大會常務委員會",
  "nsl-article-66":"日起施行",
};

const clozeDistractorOverrides={
  "basic-law-article-33":"選擇公職自由",
  "basic-law-article-34":"文化創作許可",
  "basic-law-article-35":"行政決定否決權",
  "basic-law-article-36":"劃一社會福利",
  "basic-law-article-37":"只受政策保障",
  "basic-law-article-38":"只限永久居民享有",
  "basic-law-article-39":"經本地立法先有效",
  "basic-law-article-4":"他人的權利和特權",
  "basic-law-article-21":"國家事務最終決定權",
  "basic-law-article-22":"自行管理嘅國防事務",
  "basic-law-article-24":"永久性居民和所有訪港旅客",
  "basic-law-article-40":"只獲政策性照顧",
  "basic-law-article-41":"本章部分權利及自由",
  "basic-law-article-42":"遵守法律的酌情責任",
  "basic-law-article-43":"只代表特區政府",
  "basic-law-article-44":"可持有外國居留權",
  "basic-law-article-52":"只須暫停履職",
  "basic-law-article-59":"香港特區最高權力機關",
  "basic-law-article-66":"香港特區的諮詢機關",
  "basic-law-article-74":"立法會主席口頭同意",
  "basic-law-article-79":"繼續保留議員資格",
  "basic-law-article-82":"香港特區高等法院",
  "basic-law-article-90":"可持有外國居留權",
  "basic-law-article-107":"量入為出但維持長期赤字",
  "basic-law-article-158":"國務院",
  "basic-law-article-93":"司法人員必須離任",
  "basic-law-article-121":"補地價亦毋須繳租",
  "basic-law-article-124":"關海員的臨時許可制度",
  "basic-law-article-127":"繼續由政府專營",
  "basic-law-article-129":"民航中央統一管理制度",
  "basic-law-article-130":"軍事航空管理",
  "basic-law-article-131":"香港單獨安排駐港航空公司",
  "basic-law-article-134":"軍機飛行許可",
  "basic-law-article-136":"直接管理所有院校",
  "basic-law-article-138":"療衞生服務由中央制定",
  "basic-law-article-143":"定全國統一體育政策",
  "basic-law-article-145":"削減社會福利政策",
  "basic-law-article-147":"關勞工的非約束指引",
  "basic-law-article-149":"本地組織發展關係",
  "basic-law-article-152":"本地組織及會議",
  "basic-law-article-153":"是否適用香港由中央單獨決定",
  "basic-law-annex-1":"一千二百人",
  "nsl-article-1":"保障香港完全自治",
  "nsl-article-2":"可以違背相關規定",
  "nsl-article-6":"自行選擇是否維護國安",
  "nsl-article-11":"就國安事務向立法會負責",
  "nsl-article-13":"立法會主席擔任主席",
  "nsl-article-14":"須經法院確認",
  "nsl-article-17":"只提供調查建議",
  "nsl-article-25":"三年以下有期徒刑",
  "nsl-article-35":"出任公職臨時限制",
  "nsl-article-43":"任意沒收任何財產",
  "nsl-article-53":"香港國安委受公署直接指揮",
  "nsl-article-49":"只提供國安建議",
  "nsl-article-59":"如實作證酌情責任",
  "nsl-article-60":"須由香港法院事前批准",
  "nsl-article-20":"只有使用武力才屬犯罪",
  "nsl-article-40":"本法第五十五條規定的情形亦包括",
  "nsl-article-65":"國務院",
};

Object.assign(clozeDistractorOverrides,{
  "basic-law-article-9":"中文是唯一正式語文",
  "basic-law-article-11":"可以同本法相抵觸",
  "basic-law-article-12":"直轄於廣東省人民政府",
  "basic-law-article-14":"管理香港特區的外交事務",
  "basic-law-article-18":"由中央直接實施",
  "basic-law-article-23":"等待中央代為立法",
  "basic-law-article-35":"向行政部門內部申訴",
  "basic-law-article-40":"一般經濟利益",
  "basic-law-article-59":"最高權力機關",
  "basic-law-article-66":"政策諮詢機關",
  "basic-law-article-84":"司法判例不得參考",
  "basic-law-article-92":"政治和行政經驗",
  "basic-law-article-95":"單方面發出指令",
  "basic-law-article-122":"原定租金自動加倍",
  "basic-law-article-126":"香港特區政府批准",
  "basic-law-article-127":"改由政府專營",
  "basic-law-article-129":"香港特區政府批准",
  "basic-law-article-132":"毋須諮詢香港政府",
  "basic-law-article-133":"立法會一般授權",
  "basic-law-article-134":"簽發軍用許可",
  "basic-law-article-136":"禁止私人辦學",
  "basic-law-article-142":"取消原有專業資格",
  "basic-law-article-156":"毋須向中央備案",
  "nsl-article-1":"中國人民政治協商會議",
  "nsl-article-8":"只作內部行政參考",
  "nsl-article-10":"一般公民教育",
  "nsl-article-22":"仍可正常履行職能",
  "nsl-article-28":"只作行政紀律處分",
  "nsl-article-33":"一律加重處罰",
  "nsl-article-36":"只適用香港本地法律",
  "nsl-article-41":"行政長官口頭同意",
  "nsl-article-47":"證明書僅供法院參考",
  "nsl-article-49":"公開所有國安情報",
  "nsl-article-50":"不受任何形式監督",
  "nsl-article-55":"只提供政策建議",
  "nsl-article-62":"優先適用本地法律",
  "nsl-article-64":"固定十年監禁",
});

const officialClozeAnswerOverrides={
  "basic-law-article-17":"全國人民代表大會常務委員會",
  "basic-law-article-20":"授予的其他權力",
  "basic-law-article-22":"不得干預",
  "basic-law-article-9":"英文也是正式語文",
  "basic-law-article-11":"不得同本法相抵觸",
  "basic-law-article-12":"直轄於中央人民政府",
  "basic-law-article-14":"管理香港特別行政區的防務",
  "basic-law-article-18":"公布或立法實施",
  "basic-law-article-23":"自行立法",
  "basic-law-article-35":"法院",
  "basic-law-article-40":"合法傳統權益",
  "basic-law-article-59":"行政機關",
  "basic-law-article-66":"立法機關",
  "basic-law-article-84":"司法判例可作參考",
  "basic-law-article-92":"司法和專業才能",
  "basic-law-article-95":"相互提供協助",
  "basic-law-article-122":"原定租金維持不變",
  "basic-law-article-126":"中央人民政府特別許可",
  "basic-law-article-127":"繼續自由經營",
  "basic-law-article-129":"中央人民政府特別許可",
  "basic-law-article-132":"同香港特別行政區政府磋商",
  "basic-law-article-133":"中央人民政府具體授權",
  "basic-law-article-134":"簽發執照",
  "basic-law-article-136":"興辦各種教育事業",
  "basic-law-article-142":"承認新的專業和專業團體",
  "basic-law-article-156":"報中央人民政府備案",
  "basic-law-article-159":"全國人民代表大會常務委員會",
  "nsl-article-2":"根本性條款",
  "nsl-article-8":"有效維護國家安全",
  "nsl-article-10":"國家安全教育",
  "nsl-article-22":"無法正常履行職能",
  "nsl-article-28":"凍結財產等措施",
  "nsl-article-33":"從輕、減輕處罰",
  "nsl-article-34":"驅逐出境",
  "nsl-article-37":"適用本法",
  "nsl-article-38":"適用本法",
  "nsl-article-41":"律政司長書面同意",
  "nsl-article-47":"證明書對法院有約束力",
  "nsl-article-49":"收集分析國家安全情報信息",
  "nsl-article-50":"依法接受監督",
  "nsl-article-55":"行使管轄權",
  "nsl-article-59":"如實作證的義務",
  "nsl-article-62":"適用本法規定",
  "nsl-article-64":"終身監禁",
};

Object.assign(clozeDistractorOverrides,{
  "basic-law-article-7":"不得",
  "basic-law-article-14":"管理香港特區的地方事務",
  "basic-law-article-16":"諮詢",
  "basic-law-article-18":"批准後暫緩實施",
  "basic-law-article-17":"國務院",
  "basic-law-article-20":"未經授權自行增設的權力",
  "basic-law-article-21":"無權參與",
  "basic-law-article-22":"可以直接干預",
  "basic-law-article-26":"投票權但無被選舉權",
  "basic-law-article-31":"經批准出境的權利",
  "basic-law-article-32":"活動審批制度",
  "basic-law-article-33":"許可",
  "basic-law-article-34":"許可",
  "basic-law-article-35":"行政會議",
  "basic-law-article-36":"只受政策保障",
  "basic-law-article-38":"權益和義務",
  "basic-law-article-39":"待遇和福利",
  "basic-law-article-41":"部分權利和自由",
  "basic-law-article-42":"選擇權",
  "basic-law-article-43":"立法會主席",
  "basic-law-article-52":"立法會主席",
  "basic-law-article-62":"部門內部指引涉及",
  "basic-law-article-64":"不負責",
  "basic-law-article-74":"財政司司長",
  "basic-law-article-79":"中國公民",
  "basic-law-article-82":"行政管理權",
  "basic-law-article-93":"上限",
  "basic-law-article-94":"服兵役",
  "basic-law-article-97":"拒絕",
  "basic-law-article-101":"不負責",
  "basic-law-article-106":"財政從屬中央",
  "basic-law-article-107":"收支出現盈餘",
  "basic-law-article-112":"資金自由進出政策",
  "basic-law-article-118":"技術停滯並限制新興產業",
  "basic-law-article-121":"課差餉租值的改變而提高地價",
  "basic-law-article-124":"有關海員的臨時許可制度",
  "basic-law-article-130":"停止",
  "basic-law-article-131":"臨時決定",
  "basic-law-article-137":"政治審查特權",
  "basic-law-article-138":"全國統一的醫療政策",
  "basic-law-article-143":"執行中央體育指令",
  "basic-law-article-145":"商業保險",
  "basic-law-article-147":"有關僱主的非約束指引",
  "basic-law-article-149":"公共安全",
  "basic-law-article-152":"本地",
  "basic-law-article-153":"本地",
  "basic-law-article-159":"香港特別行政區立法會",
  "basic-law-annex-1":"立法會主席",
  "nsl-article-2":"一般政策指引",
  "nsl-article-6":"選擇權",
  "nsl-article-11":"律政司司長",
  "nsl-article-13":"安全工作小組",
  "nsl-article-17":"安全事務顧問",
  "nsl-article-19":"籌集方式",
  "nsl-article-20":"行政區劃",
  "nsl-article-24":"維修",
  "nsl-article-31":"公司內部指引列明",
  "nsl-article-32":"公司內部指引列明",
  "nsl-article-34":"免除一切處罰",
  "nsl-article-35":"協助",
  "nsl-article-37":"只適用當地法律",
  "nsl-article-38":"只適用當地法律",
  "nsl-article-42":"再次",
  "nsl-article-43":"學歷證明",
  "nsl-article-45":"行政指引處理",
  "nsl-article-46":"指定",
  "nsl-article-52":"人事",
  "nsl-article-53":"財務",
  "nsl-article-54":"宣傳",
  "nsl-article-55":"行使審判權",
  "nsl-article-59":"拒絕作證的權利",
  "nsl-article-60":"政策給予",
});

Object.assign(officialClozeAnswerOverrides,{
  "basic-law-article-4":"權利和自由",
  "basic-law-article-91":"繼續保持",
  "basic-law-article-112":"不實行外匯管制政策",
  "basic-law-article-143":"香港特別行政區政府自行制定",
  "basic-law-article-147":"勞工",
  "nsl-article-46":"三名法官",
});

Object.assign(clozeDistractorOverrides,{
  "basic-law-article-4":"權利和特權",
  "basic-law-article-91":"不再保持",
  "basic-law-article-112":"實行外匯管制政策",
  "basic-law-article-143":"中央人民政府制定",
  "basic-law-article-147":"僱主",
  "nsl-article-46":"一名法官",
});

const wordingCheckOverrides={
  "nsl-article-4":{
    excerptZh:"香港特別行政區維護國家安全應當尊重和保障人權",
    correctPhraseZh:"尊重和保障",
    incorrectPhraseZh:"限制和削弱",
  },
};

const clozeNearMissMutations=[
  ["不可分離","可以分離"],
  ["實行高度自治","實行完全自治"],
  ["受法律保護","只受政策保障"],
  ["受法律保障","只受政策保障"],
  ["不受任何干涉","須受行政指示"],
  ["不受法律追究","須負行政責任"],
  ["不受追究","須負行政責任"],
  ["不受侵犯","可任意限制"],
  ["繼續有效","須重新批准"],
  ["繼續保留","即時自動失效"],
  ["原則上保留","全部自動失效"],
  ["繼續保持","即時自動失效"],
  ["即屬犯罪","只屬行政違規"],
  ["適用本法定罪處刑","只按行政程序處理"],
  ["亦適用國安法","毋須適用國安法"],
  ["適用國安法","毋須適用國安法"],
  ["適用本法","毋須適用本法"],
  ["本法規定","政策指引"],
  ["法律規定","行政指引決定"],
  ["法定職權","諮詢性職權"],
  ["法定責任","諮詢性責任"],
  ["法定限制","內部指引"],
  ["法律原則","行政慣例"],
  ["法律地位","政策定位"],
  ["法律對應解釋","政策指引解釋"],
  ["以《基本法》為依據","以部門指引為依據"],
  ["法律保障","政策保障"],
  ["法律保護","政策保障"],
  ["依法宣誓","自行決定是否宣誓"],
  ["依法處理","由行政長官酌情處理"],
  ["依法進出","毋須許可進出"],
  ["依法參與","由中央直接委任"],
  ["依法享有","經行政批准享有"],
  ["依法保守","按需要公開"],
  ["由特區管理","由中央直接管理"],
  ["由香港特區","由中央政府"],
  ["由中央政府","由香港法院"],
  ["直轄於中央政府","與中央平行自治"],
  ["中央政府任命","立法會自行任命"],
  ["中央政府簽訂","香港法院簽訂"],
  ["經中央政府批准","經立法會批准"],
  ["中央批准","立法會批准"],
  ["中央財政保障","香港私人捐款支持"],
  ["中央駐港機構","外國駐港機構"],
  ["中央授予","立法會自行增設"],
  ["行政長官委任","立法會主席委任"],
  ["行政長官主持","律政司長主持"],
  ["行政長官證明書","立法會決議"],
  ["行政長官","立法會主席"],
  ["全國人民代表大會","國務院"],
  ["人民代表大會","國務院"],
  ["表大會常務委員會","國務院常務會議"],
  ["立法會議員互選","行政長官委任"],
  ["選舉產生","中央直接委任"],
  ["選舉權和被選舉權","只享有投票權"],
  ["可連任一次","必須連任一次"],
  ["每屆任期四年","每屆任期五年"],
  ["三個月內","六個月內"],
  ["二分之一","三分之二"],
  ["五十年","三十年"],
  ["使用中英文","只可使用中文"],
  ["區旗和區徽","市旗和市徽"],
  ["財產權","財產使用許可"],
  ["終審權","行政覆核權"],
  ["立法權","立法建議權"],
  ["審判權","行政裁決權"],
  ["司法權","行政裁決權"],
  ["選擇職業自由","選擇公職自由"],
  ["文化創作自由","文化創作許可"],
  ["學術自由","學術審批制度"],
  ["信仰的自由","宗教登記許可"],
  ["結社等自由","社團登記許可"],
  ["移居其他國家和地區的自由","只可境內遷徙"],
  ["自由","行政許可"],
  ["權利和自由","行政許可"],
  ["權利及自由","行政許可"],
  ["司法補救權","行政豁免權"],
  ["社會福利","公務員福利"],
  ["受保障","須另行批准"],
  ["居民中國公民","任何外國公民"],
  ["永久性居民","所有訪港旅客"],
  ["永久居民","所有訪港旅客"],
  ["主要官員除外","包括所有主要官員"],
  ["主要官員","一般公務員"],
  ["三位司長依次代理","全體局長共同代理"],
  ["盡忠職守","只按部門指示辦事"],
  ["裁判署法庭和其他專門法庭","行政審裁機關"],
  ["外來律師執業","境外法官任職"],
  ["收支平衡","維持長期赤字"],
  ["產地來源證","出口配額證"],
  ["技術進步並開發新興產業","限制新興產業"],
  ["丁屋地維持原租金","所有土地免收租金"],
  ["船舶登記","車輛登記"],
  ["航空中心的地位","海運中心的地位"],
  ["民航運輸協定","軍事航空協定"],
  ["互不干涉","互相受其管轄"],
  ["對外關係","本地行政事務"],
  ["互免簽證協議","單方面免簽安排"],
  ["表決程序","諮詢程序"],
  ["根本責任","諮詢責任"],
  ["安全委員會","安全諮詢小組"],
  ["執法力量","民間顧問"],
  ["檢控部門","調解部門"],
  ["從重處罰","從輕處罰"],
  ["訴訟程序","行政程序"],
  ["保釋門檻","自動保釋安排"],
  ["安案件嘅法官","國安案件陪審員"],
  ["無陪審團審理","必須設陪審團審理"],
  ["日起施行","三年後施行"],
  ["港特區的行政事務","中央部門的行政事務"],
  ["法律及本地立法","行政指引及部門規則"],
  ["前一律平等","前按身份分級"],
  ["和通訊秘密受法律的保護","和通訊內容須向政府公開"],
  ["定職權","諮詢職能"],
  ["案發回立法會重議","案直接公布生效"],
  ["解散立法會","延長立法會任期"],
  ["辭職嘅三種法定情況","自行選擇辭職情況"],
  ["公布，方能生效","備案即可生效"],
  ["赴會途中不受逮捕","赴會途中仍可逮捕"],
  ["嘅法定情況","嘅行政酌情情況"],
  ["參考普通法判例","只參考行政指引"],
  ["的權利","的行政許可"],
  ["不檢而被免職","表現良好仍須免職"],
  ["從普通法地區聘任","只可由內地聘任"],
  ["內地司法機關協商互助","外國使館直接執法"],
  ["設立非政權性區域組織","設立獨立政權機關"],
  ["主要用於調節港元匯價","主要支付政府日常開支"],
  ["不徵收關稅","統一徵收關稅"],
  ["無形財產和資本的流動自由","資本流動須逐筆批准"],
  ["單獨的關稅地區","全國統一關稅地區"],
  ["制定政策促進工商業發展","限制私人商業活動"],
  ["保障科研成果","政府取得科研成果"],
  ["保障創作成果","政府取得創作成果"],
  ["旅行證件","內地居民身份證"],
  ["報中央政府備案","經中央政府事前批准"],
  ["法》外予以採用","法》外一律廢止"],
  ["官產生辦法","官直接委任辦法"],
  ["嘅全國性法律","嘅地方行政指引"],
  ["尊重和保障人權","暫停適用人權保障"],
  ["應當堅持法治原則","可按政策酌情處理"],
  ["完善相關法律","暫緩制定相關法律"],
  ["執行國安法","只提供國安建議"],
  ["媒體等推行國安教育","媒體毋須國安教育"],
  ["國安事務顧問","國安事務決策官"],
  ["法定職責","自選職責"],
  ["否使用武力均屬犯罪","只有使用武力才屬犯罪"],
  ["恐怖組織嘅刑罰","恐怖組織行政警告"],
  ["凍結財產","暫存財產"],
  ["條規定的情形除外","條規定的情形亦包括"],
  ["其他法律處理","只按內部指引處理"],
  ["受監督並保障合法權益","不受監督或法律制約"],
  ["境外駐港機構嘅管理和服務","境內民間團體監管"],
  ["家刑事訴訟法律","家行政處理指引"],
  ["國安公署履職提供便利配合","國安公署僅提供意見"],
  ["標準","臨時最低標準"],
  ["批准","備案"],
  ["保留","自動失效"],
  ["繼續","立即停止"],
  ["獨立","受行政機關指示"],
  ["負責","只提供意見"],
  ["管理","只作諮詢"],
  ["任命","選舉"],
  ["委任","選舉"],
  ["組成","提供諮詢"],
  ["制度","臨時安排"],
  ["政策","個別指引"],
  ["程序","行政慣例"],
  ["資格","臨時許可"],
  ["義務","自行選擇"],
  ["責任","建議作用"],
  ["效力","參考作用"],
  ["措施","非約束性建議"],
  ["安排","臨時建議"],
  ["服務","商業活動"],
  ["工作","諮詢意見"],
  ["撥款","私人募捐"],
  ["罰金","書面警告"],
  ["追繳或沒收","暫時保管"],
  ["從寬處罰","必須加重處罰"],
  ["被驅逐出境","自動取得居留權"],
  ["秘密","公開資料"],
  ["國際","本地"],
  ["外交","民政"],
  ["防務","稅務"],
  ["國家","地區"],
  ["香港","內地"],
  ["自行","經中央批准"],
  ["須","可以選擇"],
  ["可","必須"],
  ["有","沒有"],
];

function plausibleClozeDistractor(reference,correctAnswer) {
  const override=clozeDistractorOverrides[reference.id];
  if(override&&override!==correctAnswer)return override;
  const shortAnswerSwaps={"自由":"許可","權利":"特權","保障":"限制","保護":"限制","批准":"備案","同意":"反對","有效":"失效","辭職":"停職"};
  if(shortAnswerSwaps[correctAnswer])return shortAnswerSwaps[correctAnswer];
  for(const [source,replacement] of clozeNearMissMutations){
    if(!correctAnswer.includes(source))continue;
    const candidate=correctAnswer.replace(source,replacement);
    if(candidate!==correctAnswer&&candidate.length<=12)return candidate;
  }
  const authoritySwaps=[
    ["香港特別行政區","中央人民政府"],
    ["中央人民政府","香港特別行政區"],
    ["行政長官","立法會主席"],
    ["立法會","行政會議"],
    ["全國人民代表大會常務委員會","國務院"],
    ["全國人民代表大會","國務院"],
  ];
  for(const [source,replacement] of authoritySwaps){
    if(!correctAnswer.includes(source))continue;
    const candidate=correctAnswer.replace(source,replacement);
    if(candidate!==correctAnswer&&candidate.length<=16)return candidate;
  }
  if(correctAnswer.includes("不"))return correctAnswer.replace("不","");
  if(correctAnswer.includes("三"))return correctAnswer.replace("三","五");
  if(correctAnswer.includes("二"))return correctAnswer.replace("二","三");
  if(correctAnswer.length<=10)return `毋須${correctAnswer}`;
  return "只屬政策建議";
}

function officialLawCloze(reference) {
  const source=clean(String(reference.textZh??"").replace(/#+/gu,""))
    .replace(/\s+(?:註[:：]|資料截至[:：]).*$/su,"");
  if(!source)throw new Error(`Missing official Chinese law text for ${reference.id}`);
  const forcedAnswer=officialClozeAnswerOverrides[reference.id];
  if(forcedAnswer&&!source.includes(forcedAnswer))throw new Error(`Official cloze override is not in ${reference.id}: ${forcedAnswer}`);

  const clauses=[...source.matchAll(/[^。！？；]+[。！？；]?/gu)]
    .map((match)=>({text:match[0].trim(),offset:(match.index??0)+(match[0].length-match[0].trimStart().length)}))
    .filter(({text})=>text.length>=6);
  const preferred=[
    forcedAnswer,
    semanticClozeOverrides[reference.id],
    ...clozeSuffixes,
    ...clozeNearMissMutations.map(([phrase])=>phrase),
  ].filter((phrase,index,list)=>phrase&&phrase.length<=16&&list.indexOf(phrase)===index&&source.includes(phrase));

  const candidates=[];
  for(const clause of clauses){
    for(const phrase of preferred){
      let at=clause.text.indexOf(phrase);
      while(at>=0){
        const priority=phrase===forcedAnswer?1000:200;
        candidates.push({clause:clause.text,answer:phrase,at,score:priority+phrase.length-Math.max(0,clause.text.length-46)*5});
        at=clause.text.indexOf(phrase,at+phrase.length);
      }
    }
    for(const marker of ["不得","不受","必須","應當","應","須","享有","負責","屬於","屬","由","為","是","可","有"]){
      let at=clause.text.lastIndexOf(marker);
      if(at<0)continue;
      const answer=clause.text.slice(at+marker.length).replace(/^[：:，、\s]+/u,"").replace(/[。！？；]+$/u,"").trim();
      if(answer.length<2||answer.length>16)continue;
      candidates.push({clause:clause.text,answer,at:clause.text.lastIndexOf(answer),score:120+marker.length*2-Math.abs(answer.length-7)-Math.max(0,clause.text.length-46)*5});
    }
  }
  if(!candidates.length){
    const clause=clauses.sort((left,right)=>Math.abs(left.text.length-28)-Math.abs(right.text.length-28))[0];
    if(!clause)throw new Error(`Cannot build official-law cloze for ${reference.id}`);
    const body=clause.text.replace(/[。！？；]+$/u,"");
    const answerLength=Math.min(8,Math.max(3,Math.floor(body.length*.3)));
    candidates.push({clause:clause.text,answer:body.slice(-answerLength),at:body.length-answerLength,score:0});
  }
  candidates.sort((left,right)=>right.score-left.score||Math.abs(left.clause.length-40)-Math.abs(right.clause.length-40));
  const selected=candidates[0];
  const context=selected.clause;
  const answerAt=context.indexOf(selected.answer);
  if(answerAt<0)throw new Error(`Official-law answer fell outside excerpt for ${reference.id}`);
  return {
    stem:`${context.slice(0,answerAt)}__________${context.slice(answerAt+selected.answer.length)}`,
    answer:selected.answer,
    excerpt:context,
  };
}

function generatedReferenceQuizBlock(reference,order,id) {
  const correctClozeZh=officialLawCloze(reference);
  const incorrectZh=plausibleClozeDistractor(reference,correctClozeZh.answer);
  const explanationSource=`${reference.citationZh}訂明：「${reference.textZh}」`;
  if(order%4===0){
    const source=clean(String(reference.textZh??""));
    const wordingOverride=wordingCheckOverrides[reference.id];
    const originalExcerpt=wordingOverride?.excerptZh??correctClozeZh.excerpt;
    const correctPhrase=wordingOverride?.correctPhraseZh??correctClozeZh.answer;
    const incorrectPhrase=wordingOverride?.incorrectPhraseZh??incorrectZh;
    if(!source.includes(originalExcerpt))throw new Error(`Wording-check excerpt is not in the original law for ${reference.id}`);
    const statementIsCorrect=[...reference.id].reduce((total,char)=>total+char.codePointAt(0),0)%2===0;
    const alteredExcerpt=originalExcerpt.replace(correctPhrase,incorrectPhrase);
    if(alteredExcerpt===originalExcerpt)throw new Error(`Cannot alter the wording check for ${reference.id}`);
    if(source.includes(alteredExcerpt))throw new Error(`Altered wording still appears in the original law for ${reference.id}: ${alteredExcerpt}`);
    const statementZh=statementIsCorrect?originalExcerpt:alteredExcerpt;
    if(source.includes(statementZh)!==statementIsCorrect)throw new Error(`Wording-check truth does not match the original law for ${reference.id}`);
    const correctLabel=statementIsCorrect?"正確":"唔正確";
    const incorrectLabel=statementIsCorrect?"唔正確":"正確";
    const correctFirst=order%8===0;
    const labels=correctFirst?[correctLabel,incorrectLabel]:[incorrectLabel,correctLabel];
    const correctIndex=labels.indexOf(correctLabel);
    const answerId=String.fromCharCode(65+correctIndex);
    const explanation=statementIsCorrect
      ?`答案係 ${answerId}。呢段節錄同原文一致；${explanationSource}`
      :`答案係 ${answerId}。節錄將「${correctPhrase}」錯寫成「${incorrectPhrase}」；${explanationSource}`;
    return {
      id,
      type:"single-choice",
      question:`${reference.citationZh}以下節錄嘅用字正唔正確？「${statementZh}」`,
      options:labels.map((label,index)=>({id:String.fromCharCode(65+index),label,isCorrect:index===correctIndex})),
      feedbackCorrect:{text:explanation},
      feedbackIncorrect:{text:`未中。${explanation}`},
      questionMode:"wording-check",
      legalGrounding:{referenceId:reference.id,excerptZh:originalExcerpt,sourceUrl:reference.sourceUrl,statementZh,statementIsCorrect},
    };
  }
  const correct={labelZh:correctClozeZh.answer,isCorrect:true};
  const incorrect={labelZh:incorrectZh,isCorrect:false};
  const options=order%2===1?[correct,incorrect]:[incorrect,correct];
  const correctIndex=options.findIndex((option)=>option.isCorrect);
  const answerId=String.fromCharCode(65+correctIndex);
  const explanation=`答案係 ${answerId}。${explanationSource}`;
  return {
    id,
    type:"single-choice",
    question:`${reference.citationZh}原文：「${correctClozeZh.stem}」`,
    options:options.map((option,index)=>({id:String.fromCharCode(65+index),label:option.labelZh,isCorrect:option.isCorrect})),
    feedbackCorrect:{text:explanation},
    feedbackIncorrect:{text:`未中。${explanation}`},
    questionMode:"cloze",
    legalGrounding:{referenceId:reference.id,excerptZh:correctClozeZh.excerpt,sourceUrl:reference.sourceUrl},
  };
}

function examStrategyQuestionFlow(def,prefix) {
  const pairs=[
    [def.keys[0],"見到熟悉字眼就直接作答"],
    [def.keys[1],"唔需要分清權力主體"],
    [def.keys[2],"數字同程序可以靠估"],
  ];
  return pairs.map(([correct,incorrect],index)=>{
    const ordered=index%2===0?[correct,incorrect]:[incorrect,correct];
    const correctIndex=ordered.indexOf(correct);
    const answerId=String.fromCharCode(65+correctIndex);
    const explanation=`穩妥做法係「${correct}」。`;
    return {
      id:`generated-exam-strategy-${index+1}`,
      label:`問題 ${index+1}`,
      sourceUrl:basicLawUrl,
      block:{
        id:`${prefix}-question-${index+1}-quiz`,
        type:"single-choice",
        question:"做基本法考試題目時，應該「__________」。",
        options:ordered.map((label,optionIndex)=>({id:String.fromCharCode(65+optionIndex),label,isCorrect:optionIndex===correctIndex})),
        feedbackCorrect:{text:`答案係 ${answerId}。${explanation}`},
        feedbackIncorrect:{text:`未中。答案係 ${answerId}。${explanation}`},
      },
    };
  });
}

function lessonQuestionFlow(def,questions,references,allReferences,prefix) {
  if(def.slug==="exam-map")return examStrategyQuestionFlow(def,prefix);
  if(references.length)return references.map((reference,index)=>{
    const order=index+1;
    const existing=Number.isInteger(reference.article)?questions.find((question)=>question.domain===def.domain&&question.article===reference.article):null;
    const id=existing?.id??`generated-${reference.id}-question`;
    const blockId=`${prefix}-${Number.isInteger(reference.article)?`article-${reference.article}`:reference.id}-quiz`;
    return {
      id,
      label:referenceLabel(reference,index),
      sourceUrl:reference.sourceUrl,
      block:generatedReferenceQuizBlock(reference,order,blockId),
    };
  });
  return selectLessonQuestions(def,questions).slice(0,3).map((question,index)=>{
    const reference=allReferences.find((item)=>question.referenceIds.includes(item.id))??null;
    return {
      id:question.id,
      label:`問題 ${index+1}`,
      sourceUrl:reference?.sourceUrl??question.officialSource,
      block:twoOptionQuizBlock(question,index+1,reference,`${prefix}-question-${index+1}-quiz`),
    };
  });
}

function spotErrorBlock(def,id) {
  const drill=spotErrorBySlug[def.slug];
  if(!drill)throw new Error(`Missing spot-error drill for ${def.slug}`);
  const parts=def.keys.map((item,index)=>index===drill.wrongIndex?drill.wrong:item);
  const answerId=String.fromCharCode(65+drill.wrongIndex);
  const correction=def.keys[drill.wrongIndex];
  const explanation=`錯誤字眼係「${drill.wrong}」。應改為「${correction}」。`;
  return {
    id,
    type:"single-choice",
    question:`搵出錯誤字眼：以下選項有一處錯誤，邊部分令整個選項唔成立？<br><small>「${parts.join("；")}。」</small>`,
    options:parts.map((label,index)=>({id:String.fromCharCode(65+index),label,isCorrect:index===drill.wrongIndex})),
    feedbackCorrect:{text:`正確。${explanation}`},
    feedbackIncorrect:{text:`未中。答案係 ${answerId}。${explanation}`},
  };
}

function selectLessonQuestions(def, questions) {
  const own=questions.filter((question)=>lessonForQuestion(question).slug===def.slug);
  const fallback=questions
    .map((question,index)=>({question,index}))
    .filter(({question})=>question.domain===def.domain)
    .sort((left,right)=>{
      if(!def.articles.length)return left.index-right.index;
      const distance=({question})=>Number.isInteger(question.article)?Math.min(...def.articles.map((article)=>Math.abs(question.article-article))):Number.POSITIVE_INFINITY;
      return distance(left)-distance(right)||left.index-right.index;
    })
    .map(({question})=>question);
  const selected=[];
  const seenQuestions=new Set();
  const add=(question)=>{
    if(!question||seenQuestions.has(question.questionZh))return;
    seenQuestions.add(question.questionZh);
    selected.push(question);
  };
  for(const question of own)add(question);
  for(const question of fallback){
    if(selected.length>=5)break;
    add(question);
  }
  if(selected.length<5)throw new Error(`Lesson ${def.slug} has only ${selected.length} unique questions`);
  const lessonQuestions=selected.slice(0,5);
  if(def.articles.length){
    lessonQuestions.sort((left,right)=>{
      const leftOrder=Number.isInteger(left.article)?left.article:Number.POSITIVE_INFINITY;
      const rightOrder=Number.isInteger(right.article)?right.article:Number.POSITIVE_INFINITY;
      return leftOrder-rightOrder;
    });
  }
  return lessonQuestions;
}

function buildLesson(def, questions, references) {
  const prefix=`basic-law-${String(def.order+1).padStart(2,"0")}`;
  const refs=lessonReferences(def,references);
  const overviewPoints=lessonLearningPoints(def,refs);
  const questionFlow=lessonQuestionFlow(def,questions,refs,references,prefix);
  const intro=lessonIntroBySlug[def.slug]??[
    `今課集中處理${def.scope}。考試唔只問你見過邊個字，而係會交換主體、刪走限制語，或者用一個近似數字引你落搭。`,
    "完成後，你要可以唔睇筆記講出三個判斷重點，再將佢哋用落雙語選擇題。",
  ];
  const screens=[];
  let screenNumber=0;
  const add=(presentation,policy,blocks,title)=>{screenNumber+=1;screens.push(screen(`${prefix}-screen-${String(screenNumber).padStart(2,"0")}`,screens.length,presentation,policy,blocks,title))};
  const lawScope=def.scope.startsWith("《")?def.scope:`《${def.domain==="nsl"?"香港國安法":"基本法"}》${def.scope}`;
  const teachingTitle=def.slug==="exam-map"?"學習基本法考試方法":`學習${lawScope}`;
  const teachingIntro=def.slug==="exam-map"?"請仔細閱讀以下答題方法；稍後會有測驗，檢查你能否正確應用。":"請仔細閱讀以下官方條文，留意加粗嘅關鍵規則；稍後會有測驗，檢查你對每條法例嘅理解。";
  add("content","read",[heading(`${prefix}-intro-h`,def.title),paragraph(`${prefix}-intro-p1`,intro[0]),paragraph(`${prefix}-intro-p2`,intro[1])]);
  add("content","read",[heading(`${prefix}-map-h`,"今課重點"),{id:`${prefix}-map-list`,type:"list",ordered:false,items:overviewPoints}]);
  add("content","read",[
    heading(`${prefix}-concept-h`,teachingTitle),
    paragraph(`${prefix}-concept-p`,teachingIntro),
    {id:`${prefix}-reference-1`,type:"legal-reference",title:`官方條文｜${def.scope}`,items:refs.length?refs:[{citationZh:def.scope,citationEn:def.scope,textZh:"本節屬考試策略整理，請配合官方全文核對。",textEn:"This section covers exam strategy. Check the official full text alongside the lesson.",sourceUrl:basicLawUrl,verifiedAt}]},
  ]);
  for(const item of questionFlow)add("knowledge-check","required-interaction",[item.block],`${item.label}問題`);
  add("content","read",[
    heading(`${prefix}-review-h`,"今課總結"),
    paragraph(`${prefix}-review-p`,`你已按次序完成 ${questionFlow.length} 個重點嘅理解同測試。以下係今課重點：`),
    {id:`${prefix}-review-list`,type:"list",ordered:true,items:overviewPoints},
  ]);
  const sectionIndex=def.order<5?0:def.order<9?1:def.order<16?2:def.order<23?3:4;
  const sectionStart=[0,5,9,16,23][sectionIndex];
  return {schemaVersion:3,sourceId:`basic-law-${def.slug}`,sourceUnitId:`basic-law-unit-${sectionIndex+1}`,sourceGuideId:"basic-law-internal-prototype",slug:def.slug,title:def.title,order:def.order,readUrl:def.domain==="basic-law"?basicLawUrl:nslUrl,hasAudio:false,experience:"lesson",screens,blocks:screens.flatMap((item)=>item.blocks),raw:{internalOnly:true,lessonCode:`${String.fromCharCode(65+sectionIndex)}${def.order-sectionStart+1}`,scope:def.scope,coverage:def.articles,questionIds:questionFlow.map((item)=>item.id),questionSources:Object.fromEntries(questionFlow.map((item)=>[item.id,item.sourceUrl])),referenceStructure:"content/coursiv/courses/claude.json"}};
}

function buildMocks(questions) {
  const bl=questions.filter((question)=>question.domain==="basic-law"&&question.verificationStatus==="verified-current");
  const nsl=questions.filter((question)=>question.domain==="nsl"&&question.verificationStatus==="verified-current");
  return [0,1,2,3].map((offset)=>({id:`mock-${offset+1}`,title:`BLNST Mock ${offset+1}`,durationMinutes:30,passScore:10,targetScore:16,questionIds:[...Array.from({length:14},(_,index)=>bl[(offset*14+index)%bl.length].id),...Array.from({length:6},(_,index)=>nsl[(offset*6+index)%nsl.length].id)]}));
}

async function main() {
  const ocr=await readFile(ocrPath,"utf8");
  const pageMap=pagesFromOcr(ocr);
  const parsed=[];
  for(const group of groupStarts){let raw="";for(let page=group.page;page<=group.end;page++)raw+=`\n${pageMap.get(page)??""}`;let answers;const overrides=group.domain==="basic-law"&&group.set===5?{3:"D",8:"B"}:group.domain==="nsl"&&group.set===8?{4:"A",5:"D",9:"A",10:"A"}:{};try{answers=extractAnswerKey(raw,group.count,overrides);}catch(error){throw new Error(`${group.domain} set ${group.set}: ${error.message}`)}const chunks=extractQuestionChunks(raw,group.count);for(let index=0;index<group.count;index++)parsed.push(parseQuestion(chunks[index],answers[index],{domain:group.domain,set:group.set,number:index+1,page:group.page}));}
  if(parsed.length!==310)throw new Error(`Expected 310 questions, found ${parsed.length}`);
  let questions;
  let references;
  const audit=JSON.parse(await readFile(join(root,"content/basic-law/question-audit.json"),"utf8"));
  try {
    const cached=JSON.parse(await readFile(join(root,"content/basic-law/question-bank.json"),"utf8"));
    const cachedReferences=JSON.parse(await readFile(join(root,"content/basic-law/legal-references.json"),"utf8"));
    if(cached.questions?.length!==310||cachedReferences.references?.length<226)throw new Error("cache incomplete");
    questions=cached.questions.map((question,index)=>({
      ...question,
      questionZh:parsed[index].questionZh,
      options:question.options.map((option,optionIndex)=>({...option,labelZh:parsed[index].options[optionIndex].labelZh})),
    }));
    references=cachedReferences.references;
  } catch {
    questions=await translateQuestions(parsed);
    const basicReferences=await fetchBasicLawReferences();
    const nslChinese=extractNslReferences(pageMap);
    const nslReferences=await mapConcurrent(nslChinese,8,async(item)=>({...item,textEn:await translate(item.textZh)}));
    references=[...basicReferences,...nslReferences].sort((a,b)=>a.domain.localeCompare(b.domain)||a.article-b.article);
  }
  questions=await mapConcurrent(questions,8,async(question)=>({...question,questionEn:question.questionEn||await translate(question.questionZh),options:await mapConcurrent(question.options,2,async(option)=>({...option,labelEn:option.labelEn||await translate(option.labelZh)}))}));
  questions=applyQuestionAudit(questions,audit);
  references=normalizeReferences(references);
  questions=ensureQuestionLawMentions(questions,references);
  questions=restoreMissingQuestionBlanks(questions,references);
  questions=applyQuestionWordingOverrides(questions);
  const referenceIds=new Set(references.map((reference)=>reference.id));
  for(const question of questions)for(const referenceId of question.referenceIds)if(!referenceIds.has(referenceId))throw new Error(`${question.id} references missing legal source ${referenceId}`);
  const activeQuestions=questions.filter((question)=>question.verificationStatus==="verified-current");
  const mocks=buildMocks(activeQuestions);
  const units=[
    {sourceId:"basic-law-unit-1",title:"考試與憲制基礎",order:0,code:"A"},
    {sourceId:"basic-law-unit-2",title:"居民權利與義務",order:1,code:"B"},
    {sourceId:"basic-law-unit-3",title:"政治體制",order:2,code:"C"},
    {sourceId:"basic-law-unit-4",title:"經濟、社會及對外事務",order:3,code:"D"},
    {sourceId:"basic-law-unit-5",title:"香港國安法",order:4,code:"E"},
  ].map((unit)=>({...unit,lessons:lessonDefs.filter((def)=>`basic-law-unit-${def.order<5?1:def.order<9?2:def.order<16?3:def.order<23?4:5}`===unit.sourceId).map((def)=>buildLesson(def,activeQuestions,references))}));
  const course={schemaVersion:3,id:"basic-law",sourceId:"basic-law-internal-prototype",kind:"use-case",title:"BLNST Basic Law Exam Prep",image:"/images/courses/basic-law/status-authority-relationship.png",localImage:"/images/courses/basic-law/status-authority-relationship.png",duration:"3.5 hours",categories:["Internal prototype","Exam prep","Basic Law"],sourceUpdatedAt:verifiedAt,units};
  const practiceBlock={id:"basic-law-practice-bank-heading",type:"heading",level:2,text:"310 題 Practice Bank"};
  const practiceScreen={id:"basic-law-practice-bank-screen",sourcePageId:"basic-law-practice-bank",order:0,type:"chunk",presentation:"content",interactionPolicy:"read",blocks:[practiceBlock]};
  const practiceCourse={schemaVersion:3,id:"basic-law-practice",sourceId:"basic-law-practice-course",kind:"use-case",title:"BLNST 310 題 Practice Bank",image:"/images/courses/basic-law/status-authority-relationship.png",localImage:"/images/courses/basic-law/status-authority-relationship.png",duration:"Self-paced",categories:["Internal prototype","Exam prep","Practice bank"],sourceUpdatedAt:verifiedAt,units:[{sourceId:"basic-law-practice-unit-1",title:"題庫操練",order:0,code:"A",lessons:[{schemaVersion:3,sourceId:"basic-law-practice-bank",sourceUnitId:"basic-law-practice-unit-1",sourceGuideId:"basic-law-practice-course",slug:"practice-bank",title:"310 題 Practice Bank",order:0,readUrl:basicLawUrl,hasAudio:false,experience:"practice",screens:[practiceScreen],blocks:[practiceBlock],raw:{internalOnly:true,lessonCode:"A1",questionCount:310}}]}]};
  const mockCourse={schemaVersion:3,id:"basic-law-mocks",sourceId:"basic-law-mocks-course",kind:"use-case",title:"BLNST 30 分鐘模擬試",image:"/images/courses/basic-law/status-authority-relationship.png",localImage:"/images/courses/basic-law/status-authority-relationship.png",duration:"2 hours",categories:["Internal prototype","Exam prep","Mock exams"],sourceUpdatedAt:verifiedAt,units:[{sourceId:"basic-law-mocks-unit-1",title:"計時模擬試",order:0,code:"A",lessons:mocks.map((mock,index)=>{const block={id:`basic-law-${mock.id}-heading`,type:"heading",level:2,text:mock.title};const screen={id:`basic-law-${mock.id}-screen`,sourcePageId:`basic-law-${mock.id}`,order:0,type:"chunk",presentation:"content",interactionPolicy:"read",blocks:[block]};return{schemaVersion:3,sourceId:`basic-law-${mock.id}`,sourceUnitId:"basic-law-mocks-unit-1",sourceGuideId:"basic-law-mocks-course",slug:mock.id,title:mock.title,order:index,readUrl:basicLawUrl,hasAudio:false,experience:"mock",screens:[screen],blocks:[block],raw:{internalOnly:true,lessonCode:`A${index+1}`,mockId:mock.id}}})}]};
  const corrections={source:ocrPath,generatedAt:new Date().toISOString(),internalOnly:true,summary:{questions:questions.length,basicLawQuestions:questions.filter((q)=>q.domain==="basic-law").length,nslQuestions:questions.filter((q)=>q.domain==="nsl").length,verifiedCurrent:activeQuestions.length,retired:questions.filter((q)=>q.verificationStatus==="retired").length},automaticCorrections:[{pattern:"answer key 0",replacement:"D",reason:"OCR commonly confused the printed letter D with zero."},{pattern:"option marker joined to previous line",replacement:"new option line",reason:"Restored A–D option boundaries."},{pattern:"missing question numbers",replacement:"sequence inferred from each 15/10-question exercise",reason:"Preserved one-to-one exercise order."}],retiredQuestionIds:questions.filter((q)=>q.verificationStatus==="retired").map((q)=>q.id)};
  const outputs=[
    ["content/basic-law/question-bank.json",{schemaVersion:2,internalOnly:true,source:ocrPath,generatedAt:new Date().toISOString(),questions}],
    ["content/basic-law/legal-references.json",{schemaVersion:1,verifiedAt,references}],
    ["content/basic-law/mocks.json",{schemaVersion:1,internalOnly:true,mocks}],
    ["content/basic-law/ocr-corrections.json",corrections],
    ["content/coursiv/courses/basic-law.json",course],
    ["content/coursiv/courses/basic-law-practice.json",practiceCourse],
    ["content/coursiv/courses/basic-law-mocks.json",mockCourse],
  ];
  for(const [relative,data] of outputs){const target=join(root,relative);await mkdir(dirname(target),{recursive:true});await writeFile(target,`${JSON.stringify(data,null,2)}\n`);console.log(`wrote ${relative}`);}
  console.log(JSON.stringify({lessons:course.units.flatMap((unit)=>unit.lessons).length,screens:course.units.flatMap((unit)=>unit.lessons).reduce((sum,lesson)=>sum+lesson.screens.length,0),questions:questions.length,references:references.length,mocks:mocks.length},null,2));
}

await main();
