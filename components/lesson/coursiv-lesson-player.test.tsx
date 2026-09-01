import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import type { CoursivContentBlock } from "@/lib/coursiv-content";
import { LegalReference, legalReferenceParts } from "./legal-reference";
import { OptionalQuizActions } from "./optional-quiz-actions";
import { PlainLanguageReview } from "./plain-language-review";
import { RecallCard, recallAnswerPoints } from "./recall-card";
import { LegalLessonPointList, LegalLessonSummaryHeading } from "./legal-lesson-summary";

vi.mock("../shared/safe-rich-text",()=>({
  SafeRichText:({value,as:Tag="div",className}:{value:string;as?:"div"|"p";className?:string})=><Tag className={className}>{value}</Tag>,
}));

const block:Extract<CoursivContentBlock,{type:"matching-pairs"}>={
  id:"plain-language-review",
  type:"matching-pairs",
  title:"重點 → 白話",
  prompt:"Legacy matching instructions",
  pairs:[
    {id:"pair-1",left:"法院保有獨立審判權",right:"白話：法官判案唔需要聽政府指示。"},
    {id:"pair-2",left:"中央部門不得干預自治事務",right:"白話：香港依法自行管理嘅事務唔應受中央部門干預。"},
    {id:"pair-3",left:"香港有自行立法責任",right:"白話：香港要按《基本法》要求自行制定相關法律。"},
  ],
};

describe("PlainLanguageReview",()=>{
  it("starts directly with the first quiz question",()=>{
    const html=renderToStaticMarkup(<PlainLanguageReview block={block} onResolved={()=>undefined}/>);
    expect(html).toContain("快速小測");
    expect(html).toContain("1/3");
    expect(html).toContain("以下邊個解釋正確？");
    expect(html).not.toContain("揀出正確嘅白話解釋");
    expect(html).not.toContain("用白話講，即係咩意思？");
    expect(html).toContain("法院保有獨立審判權");
    expect(html).toContain("法官判案唔需要聽政府指示。");
    expect(html).toContain("確認答案");
    expect(html).not.toContain("溫習卡");
    expect(html).not.toContain("今課三個重點");
    expect(html).not.toContain("白話即係");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Legacy matching instructions");
    expect(html).not.toContain("白話：法官");
  });
});

describe("CoursivLessonPlayer optional quiz actions",()=>{
  it("makes starting the quiz primary and keeps skip as the secondary action",()=>{
    const html=renderToStaticMarkup(<OptionalQuizActions busy={false} onStart={()=>undefined} onSkip={()=>undefined}/>);

    expect(html).toContain('class="canonical-quiz-actions"');
    expect(html).toContain('class="canonical-quiz-start"');
    expect(html).toContain(">Start quiz</button>");
    expect(html).toContain('class="canonical-quiz-skip"');
    expect(html).toContain(">Skip quiz</button>");
    expect(html.match(/Start quiz/g)).toHaveLength(1);
  });
});

describe("RecallCard",()=>{
  it("keeps the recall answer hidden until the learner reveals it",()=>{
    const recallBlock:Extract<CoursivContentBlock,{type:"callout"}>={
      id:"basic-law-02-final-recall",
      type:"callout",
      title:"離開前再講一次",
      text:"唔睇畫面，講出：香港係中國不可分離部分 → 高度自治源自全國人大授權 → 原有制度按《基本法》維持。講得出先算真正記得。",
      tone:"tip",
    };
    const html=renderToStaticMarkup(<RecallCard block={recallBlock}/>);
    expect(html).toContain("最後重溫");
    expect(html).not.toContain("Revision");
    expect(html).not.toContain("離開前再講一次");
    expect(html).toContain("先唔好睇答案，試下自己講出今課三個重點。");
    expect(html).toContain("顯示答案");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("香港係中國不可分離部分");
  });

  it("formats each recall answer as a separate point",()=>{
    expect(recallAnswerPoints("唔睇畫面，講出：重點一 → 重點二 → 重點三。講得出先算真正記得。")).toEqual(["重點一","重點二","重點三"]);
  });
});

describe("LegalReference",()=>{
  it("preserves bullet-form provisions as separate points",()=>{
    expect(legalReferenceParts("行政長官行使下列職權： • 領導政府； • 公布法律；")).toEqual({
      lead:"行政長官行使下列職權：",
      points:["領導政府；","公布法律；"],
    });

    const legalBlock:Extract<CoursivContentBlock,{type:"legal-reference"}>={
      id:"article-48-reference",
      type:"legal-reference",
      title:"官方條文｜第 48 條",
      items:[{
        citationZh:"《基本法》第 48 條",
        citationEn:"Basic Law Article 48",
        textZh:"行政長官行使下列職權： • 領導政府； • 公布法律；",
        textEn:"The Chief Executive shall: • Lead the government; • Promulgate laws.",
        sourceUrl:"https://www.basiclaw.gov.hk/",
        verifiedAt:"2026-08-12",
      }],
    };

    const html=renderToStaticMarkup(<LegalReference block={legalBlock} initiallyExpanded/>);

    expect(html).toContain('class="legal-reference-text"');
    expect(html).toContain("<ul><li>");
    expect(html.match(/<li>/g)).toHaveLength(4);
    expect(html).not.toContain("•");
  });

  it("starts expanded while its screen is current",()=>{
    const legalBlock:Extract<CoursivContentBlock,{type:"legal-reference"}>={
      id:"articles-19-23-reference",
      type:"legal-reference",
      title:"官方條文｜第 19–23 條",
      items:[{
        citationZh:"《基本法》第 19 條",
        citationEn:"Article 19 of the Basic Law",
        textZh:"香港特別行政區享有獨立的司法權和終審權。",
        textEn:"The Hong Kong Special Administrative Region shall be vested with independent judicial power.",
        sourceUrl:"https://www.basiclaw.gov.hk/",
        verifiedAt:"2026-08-12",
      }],
    };

    const html=renderToStaticMarkup(<LegalReference block={legalBlock} initiallyExpanded/>);

    expect(html).toContain('<details class="canonical-legal-reference" open="">');
    expect(html).toContain("1 條參考");
    expect(html).toContain('aria-label="官方條文｜第 19–23 條條文內容"');
    expect(html).toContain("《基本法》第 19 條");
  });

  it("starts folded after its screen is no longer current",()=>{
    const legalBlock:Extract<CoursivContentBlock,{type:"legal-reference"}>={
      id:"past-reference",
      type:"legal-reference",
      title:"官方條文｜第 19–23 條",
      items:[],
    };

    const html=renderToStaticMarkup(<LegalReference block={legalBlock} initiallyExpanded={false}/>);

    expect(html).toContain('<details class="canonical-legal-reference">');
    expect(html).not.toContain(' open=""');
    expect(html).toContain("0 條參考");
  });
});

describe("Legal lesson visual summary",()=>{
  const points=[
    "第 1 條：香港特區係中華人民共和國不可分離嘅部分。",
    "第 2 條：全國人大授權香港特區依照《基本法》實行高度自治。",
  ];

  it("renders a completion hero with the finished article count",()=>{
    const html=renderToStaticMarkup(<LegalLessonSummaryHeading title="今課總結" count={2} unit="條文"/>);
    expect(html).toContain("legal-lesson-summary-hero");
    expect(html).toContain("2/2 條文完成");
    expect(html).toContain("今課總結");
  });

  it("turns the shared learning points into article cards",()=>{
    const html=renderToStaticMarkup(<LegalLessonPointList items={points} summary/>);
    expect(html).toContain('class="legal-lesson-points summary"');
    expect(html).toContain('class="legal-lesson-point-text"');
    expect(html).toContain("第 1 條");
    expect(html).toContain("不可分離嘅部分");
    expect(html.match(/<li/g)).toHaveLength(2);
  });
});
