// Real payloads from Canva's MCP server, captured 2026-09-03 through the
// claude.ai Canva connector. They are evidence, not a spec: mcp.canva.com
// publishes no API version and no deprecation policy, and the format had
// already changed once before this capture (canvaCdf.ts parses the earlier
// line-oriented markdown). Ids and signed URLs are redacted.
//
// Kept so that if the MCP path ever resumes (see canvaMcp.ts), the parser
// for this shape is written against what the server actually sent.

/** read-design with open_transaction: a single-page design holding one
 * image-filled rect. Note the transaction id's location and that
 * design_content is an object. */
export const READ_DESIGN_IMAGE_RECT = {
  page_metadata: [
    {
      id: "PBpYHXxlX5QvQqRs",
      index: 1,
      page_number: 1,
      dimensions: { width: 1080, height: 1350 },
      design_type: "unknown",
    },
  ],
  transaction: { transaction_id: "3614653457834840330" },
  design_content: {
    title: "",
    pages: [
      {
        type: "fixed",
        id: "PBpYHXxlX5QvQqRs",
        dimensions: { width: 1080, height: 1350 },
        background: { color: { type: "solid", color: "#ffffff" }, isMediaReplaceable: true },
        elements: [
          {
            id: "LBjTPfNvKScDW0cx",
            top: 205.5619683975927,
            left: -1.1368683772161603e-13,
            width: 1080.0000000000002,
            height: 633.3245382585754,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            type: "rect",
            fill: {
              media: {
                type: "image",
                mediaId: "MAGYJ8bqah0",
                imageBox: {
                  top: -1.1368683772161603e-13,
                  left: 0,
                  width: 1080.0000000000002,
                  height: 633.3245382585754,
                  rotation: 0,
                },
              },
              isMediaReplaceable: true,
              flipX: false,
              flipY: false,
            },
            stroke: { weight: 0, color: { type: "solid", color: "#000000" } },
            locator_id: "PBpYHXxlX5QvQqRs-LBjTPfNvKScDW0cx",
          },
        ],
        isEditable: true,
        locator_id: "PBpYHXxlX5QvQqRs",
      },
    ],
    page_metadata: {
      returned_page_indices: [1],
      total_pages: 1,
      truncated: false,
      message: "Showing all 1 page(s).",
    },
  },
};

/** Page 1 of a 15-page presentation: two groups, each holding shapes or
 * text. Children carry absolute page coordinates. textAlign is "start". */
export const READ_DESIGN_PRESENTATION_PAGE_1 = {
  page_metadata: [
    {
      id: "PB3NhfdWtTvrKNgm",
      index: 1,
      page_number: 1,
      dimensions: { width: 1920, height: 1080 },
      design_type: "presentation",
    },
  ],
  transaction: { transaction_id: "3989578127879302615" },
  design_content: {
    title: "Presentation - AI Search Visibility Priorities",
    pages: [
      {
        type: "fixed",
        id: "PB3NhfdWtTvrKNgm",
        dimensions: { width: 1920, height: 1080 },
        background: { color: { type: "solid", color: "#0e374b" }, isMediaReplaceable: true },
        elements: [
          {
            id: "LBP0CkJHWlgHpn3f",
            top: 46.5,
            left: 1121.6917556368683,
            width: 753.6339719780381,
            height: 987,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            type: "group",
            children: [
              {
                id: "LBF77xL9nR3HHTK8",
                top: 61.5,
                left: 1121.6917556368683,
                width: 738.6339719780376,
                height: 972,
                rotation: 0,
                opacity: 1,
                isLocked: false,
                type: "shape",
                viewBox: { top: 0, left: 0, width: 64, height: 64 },
                paths: [
                  {
                    d: "M0 0H64V64H0z",
                    fill: { color: { type: "solid", color: "#216278" }, isMediaReplaceable: false },
                    stroke: { weight: 0, color: { type: "solid", color: "#000000" } },
                    cornerRounding: 20,
                  },
                ],
                textContents: [{ textRegions: [] }],
                nineSlice: {
                  sliceBox: { top: 0, left: 0, width: 64, height: 64 },
                  resizeCenter: { width: 142.5984426490063, height: 187.65138284074942 },
                },
                locator_id: "PB3NhfdWtTvrKNgm-LBP0CkJHWlgHpn3f-LBF77xL9nR3HHTK8",
              },
              {
                id: "LBtTqL9p5C6KhqdF",
                top: 46.5,
                left: 1136.6917556368685,
                width: 738.6339719780378,
                height: 972,
                rotation: 0,
                opacity: 1,
                isLocked: false,
                type: "shape",
                viewBox: { top: 0, left: 0, width: 64, height: 64 },
                paths: [
                  {
                    d: "M0 0H64V64H0z",
                    fill: {
                      media: {
                        type: "image",
                        mediaId: "MAHTgtfkhZY",
                        imageBox: {
                          top: 0,
                          left: -116.68301401098086,
                          width: 971.9999999999999,
                          height: 971.9999999999999,
                          rotation: 0,
                        },
                      },
                      isMediaReplaceable: true,
                      flipX: false,
                      flipY: false,
                    },
                    stroke: { weight: 0, color: { type: "solid", color: "#000000" } },
                    cornerRounding: 15,
                  },
                ],
                textContents: [],
                nineSlice: {
                  sliceBox: { top: 0, left: 0, width: 64, height: 64 },
                  resizeCenter: { width: 85.8252981238098, height: 112.94117647058823 },
                },
                locator_id: "PB3NhfdWtTvrKNgm-LBP0CkJHWlgHpn3f-LBtTqL9p5C6KhqdF",
              },
            ],
            locator_id: "PB3NhfdWtTvrKNgm-LBP0CkJHWlgHpn3f",
          },
          {
            id: "LBqNcRc51vg1qrcy",
            top: 383.4672222689685,
            left: 139.946185525283,
            width: 820.053814474717,
            height: 313.065555462063,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            type: "group",
            children: [
              {
                id: "LBJL2kZN1VWf6nrz",
                top: 447.8661777310315,
                left: 139.94618552528289,
                width: 820.053814474717,
                height: 248.6666,
                rotation: 0,
                opacity: 1,
                isLocked: false,
                type: "text",
                textRegions: [
                  {
                    characters: "GEO/ AI Search Strategy",
                    formatting: {
                      fontSize: 113.333,
                      fontWeight: "bold",
                      fontStyle: "normal",
                      color: "#ffffff",
                      textAlign: "start",
                      decoration: "none",
                      strikethrough: "none",
                      link: "",
                      listMarker: "none",
                      listLevel: 0,
                      lineHeight: 1,
                      letterSpacing: -0.03,
                      fontRef: "YAFdJjbTu24,1",
                    },
                  },
                ],
                locator_id: "PB3NhfdWtTvrKNgm-LBqNcRc51vg1qrcy-LBJL2kZN1VWf6nrz",
              },
              {
                id: "LBPFWv6dsLZXZM2d",
                top: 383.4672222689685,
                left: 139.94618552528289,
                width: 820.053814474717,
                height: 54,
                rotation: 0,
                opacity: 1,
                isLocked: false,
                type: "text",
                textRegions: [
                  {
                    characters: "Endo Kids Concierge",
                    formatting: {
                      fontSize: 45.3332,
                      fontWeight: "normal",
                      fontStyle: "normal",
                      color: "#f14e62",
                      textAlign: "start",
                      decoration: "none",
                      strikethrough: "none",
                      link: "",
                      listMarker: "none",
                      listLevel: 0,
                      lineHeight: 1.2,
                      letterSpacing: -0.03,
                      fontRef: "YAEnXEEs5-Q,0",
                    },
                  },
                ],
                locator_id: "PB3NhfdWtTvrKNgm-LBqNcRc51vg1qrcy-LBPFWv6dsLZXZM2d",
              },
            ],
            locator_id: "PB3NhfdWtTvrKNgm-LBqNcRc51vg1qrcy",
          },
        ],
        isEditable: true,
        locator_id: "PB3NhfdWtTvrKNgm",
      },
    ],
    page_metadata: {
      returned_page_indices: [1],
      total_pages: 15,
      truncated: true,
      message: "Showing page(s) 1 of 15 total.",
    },
  },
};

/** export-design: the job wrapper the MCP tool returns. The status arrived
 * as success synchronously; the URL's X-Amz-Expires was about 16.5 hours. */
export const EXPORT_DESIGN = {
  job: {
    id: "fec28526-516c-401e-89a7-b23dbd274351",
    status: "success",
    urls: [
      "https://export-download.canva.com/REDACTED/0001-REDACTED.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=59494",
    ],
  },
};
