import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { optionalEnum, parseBody, requireString, requireUuid } from "../_shared/validate.ts";
import { warningStrings } from "../_shared/extract.ts";
import { importResponse, runFigmaImport } from "../_shared/figmaImportRun.ts";
import { NO_MODEL_COST, intentReport, unfilledIssue } from "../_shared/importIntent.ts";

/** Import from Figma without the model pass. Two modes:
 *
 *  - template (default): render the frame to PNG (the template background)
 *    and walk its tree into TemplateFields. The keys in the layer names and
 *    the auto layout around them decide what members fill in; an unkeyed
 *    layer lands FIXED with its designed content.
 *
 *  - elements: no background at all. The node (a layer link pasted onto the
 *    canvas) becomes live elements: text/image/shape fields from the walk,
 *    and everything left over decomposed into rendered units the client
 *    places as fixed shapes/images in exact paint order.
 *
 * template-autobuild runs this same import (figmaImportRun.ts) and then asks
 * the model for what the keys leave open. This function is what the builder
 * falls back to when that one can't answer, so an import never depends on
 * the model.
 *
 * Component instances and complex effects may not map cleanly — anything
 * suspicious lands in `warnings` (with per-layer detail in
 * `warningDetails`) and the admin confirms every suggestion. The manual PNG
 * path never depends on this function. */

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const url = requireString(body.url, "url", 2048);
    const mode = optionalEnum(body.mode, "mode", ["template", "elements"] as const) ?? "template";

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const run = await runFigmaImport({ db: serviceClient(), companyId, url, mode });
    run.details.push(unfilledIssue(run.frameName, mode));
    return json(
      importResponse(run, warningStrings, {
        frameName: run.frameName,
        intent: intentReport({
          fields: run.fields,
          intents: run.intents,
          parse: run.parse,
          capTrim: run.capTrim,
          filledBy: "keys",
          cost: NO_MODEL_COST,
        }),
      }),
    );
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-import", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
