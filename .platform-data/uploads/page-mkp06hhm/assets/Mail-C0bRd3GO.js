import { G as h, H as g, w, O as D, l as v, D as M, ab as u, ac as p, S as a, Q as s, M as b, aI as x, aJ as T, a5 as k, E as i, P as l, F as I, ad as N, V as n, R as c, aK as O } from "./index-ex9E0DB9.js";
const S = { class: "center" }, V = ["srcdoc"], B = { __name: "Mail", setup(C) {
  const { telegramApp: r, loading: _, useUTCDate: f } = g(), m = x(), e = v({});
  w(r, async () => {
    r.value.initData && (e.value = await d());
  });
  const d = async () => {
    try {
      const t = await b.fetch("/telegram/get_mail", { method: "POST", body: JSON.stringify({ initData: r.value.initData, mailId: m.query.mail_id }) });
      return _.value = true, await T(t);
    } catch (t) {
      return console.error(t), {};
    } finally {
      _.value = false;
    }
  };
  return D(async () => {
    e.value = await d();
  }), (t, E) => {
    const o = N, y = k;
    return i(), M("div", S, [a(e).message ? (i(), u(y, { key: 0, bordered: false, embedded: "", style: { "max-width": "800px", height: "100%" } }, { default: s(() => [l(o, { type: "info" }, { default: s(() => [n(" ID: " + c(a(e).id), 1)]), _: 1 }), l(o, { type: "info" }, { default: s(() => [n(" Date: " + c(a(O)(a(e).created_at, a(f))), 1)]), _: 1 }), l(o, { type: "info" }, { default: s(() => [n(" FROM: " + c(a(e).source), 1)]), _: 1 }), t.showEMailTo ? (i(), u(o, { key: 0, type: "info" }, { default: s(() => [n(" TO: " + c(a(e).address), 1)]), _: 1 })) : p("", true), I("iframe", { srcdoc: a(e).message, style: { "margin-top": "10px", width: "100%", height: "100%" } }, null, 8, V)]), _: 1 })) : p("", true)]);
  };
} }, F = h(B, [["__scopeId", "data-v-5ff036bb"]]);
export {
  F as default
};
