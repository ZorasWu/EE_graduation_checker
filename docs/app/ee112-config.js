export const EE112_CONFIG = {
  graduationCredits: 132,
  projectCapCredits: 6,
  projectCapCourseIds: ["EE4004", "EE4023", "EE3045"],
  freshmanEnglishCredits: 6,
  freshmanEnglishCourseIds: ["LN1001", "LN1002"],
  serviceLearningCourseIds: ["SC0003", "SC0004"],
  requiredCourseSetA: [
    { courseId: "EE1003", title: "計算機概論 I", credits: 3 },
    { courseId: "EE1006", title: "數位邏輯實驗", credits: 1 },
    { courseId: "EE1007", title: "計算機概論實習", credits: 1 },
    { courseId: "EE1009", title: "工程數學-線性代數", credits: 3 },
    { courseId: "EE1010", title: "工程數學-微分方程", credits: 3 },
    { courseId: "EE2001", title: "電子學 I", credits: 3 },
    { courseId: "EE2002", title: "電路學 I", credits: 3 },
    { courseId: "EE2004", title: "電磁學 I", credits: 3 },
    { courseId: "EE2009", title: "電子學 II", credits: 3 },
    { courseId: "EE2011", title: "電路學 II", credits: 3 },
    { courseId: "EE2015", title: "電磁學 II", credits: 3 },
    { courseId: "EE2016", title: "數位系統導論", credits: 3 },
    { courseId: "EE2027", title: "電子電路實驗 I", credits: 1 },
    { courseId: "EE2028", title: "電子電路實驗 II", credits: 1 },
    { courseId: "EE2030", title: "工程數學-複變", credits: 3 },
    { courseId: "EE3047", title: "電子電路實驗 III", credits: 1 },
    { courseId: "EE3049", title: "積體電路設計專題", credits: 3 },
    { courseId: "MA1003", title: "微積分 I", credits: 3 },
    { courseId: "MA1004", title: "微積分 II", credits: 3 },
    { courseId: "PH1003", title: "普物實驗 I", credits: 1 },
    { courseId: "PH1004", title: "普物實驗 II", credits: 1 },
    { courseId: "PH1031", title: "普通物理 A I", credits: 3 },
    { courseId: "PH1032", title: "普通物理 A II", credits: 3 }
  ],
  departmentCollegeElective: {
    minCredits: 12,
    allowedPrefixes: ["EE", "CO", "CE"],
    description: "系同學畢業以前須自本系或資電學院開授的課程中選修 12 學分，始得畢業(不包含第2項之18學分及第3項之9學分)。"
  },
  starElective: {
    portalRuleId: "13200",
    minCredits: 18,
    minCategories: 3,
    categories: {
      electronics: {
        title: "電子類別",
        courseIds: ["EE3001", "EE3032", "EE4032", "EE3040", "EE4012", "EE6057", "EE7026", "EE6083", "EE8027", "EE6094"]
      },
      solidState: {
        title: "固態類別",
        courseIds: ["EE2023", "EE2025", "EE3001", "EE3029", "EE3034", "EE4028", "EE4030", "EE6033", "EE8035", "EE7039", "EE6044", "EE8074", "EE8079", "EE8061", "EE8006", "EE8083", "EE6020", "EE8031", "EE8022", "EE8020", "EE7052"]
      },
      systemsBiomedical: {
        title: "系統與生醫類別",
        courseIds: ["EE3003", "EE3010", "EE3014", "EE3042", "EE3051", "EE3054", "EE6010", "EE7080", "EE8058", "EE6036", "EE8086", "EE8090", "EE8077", "EE8008", "EE8043", "EE8016", "EE8041", "EE8087", "EE6009", "EE8084"]
      },
      electroCommunication: {
        title: "電通訊類別",
        courseIds: ["CO4003", "CO6005", "CO6019", "CO6025", "CO6041", "CO6048", "CO6061"]
      },
      wave: {
        title: "電波類別",
        courseIds: ["EE3004", "CO3007", "EE3038", "EE4013", "CO3008", "EE4034", "EE4038", "EE8028", "EE8053", "EE5006", "EE8026", "EE8038", "EE5009", "EE8013", "EE8072", "EE8014", "EE8089", "EE8050", "EE8042", "EE8091", "EE8063"]
      },
      infoCommunication: {
        title: "資通訊類別",
        courseIds: ["EE2007", "EE3035", "CO3019", "CE2003", "CO2012", "CE2002", "CO3006", "CO2014", "CE3005", "CO3005", "CO3020", "CE3001", "CO6032", "CO6063", "CO3024", "CO4010"]
      }
    }
  },
  labElective: {
    portalRuleId: "13300",
    minCredits: 9,
    minCategories: 3,
    categories: {
      electronics: {
        title: "電子類別",
        courseIds: ["EE3044", "EE3053"]
      },
      solidState: {
        title: "固態類別",
        courseIds: ["EE4027", "EE4042"]
      },
      electroCommunication: {
        title: "電通訊類別",
        courseIds: ["CO4009"]
      },
      wave: {
        title: "電波類別",
        courseIds: ["EE4036"]
      },
      systemsBiomedical: {
        title: "系統與生醫類別",
        courseIds: ["EE3046", "EE3055", "EE8023"]
      },
      infoCommunication: {
        title: "資通訊類別",
        courseIds: ["CO3024", "CO4010"]
      }
    }
  },
  portalOnlyRuleIds: ["11320", "11400", "18100", "18200", "18300", "18500", "19200"],
  derivedPortalMappings: {
    freshmanEnglish: "11201",
    serviceLearning: "18400",
    requiredCourseSetA: "12101",
    starElective: "13200",
    labElective: "13300",
    projectCap: "19260"
  }
};
