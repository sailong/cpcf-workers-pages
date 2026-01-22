import { T as z, E } from "./index.esm-Bna_jRUN.js";
import { G as P, I as H, H as I, J as F, aL as J, aM as $, O as D, M as p, D as f, ac as S, S as e, E as d, P as a, Q as s, ao as G, V as b, R as i, K, aN as Y, F as M, ap as Q, as as Z, T as W, Z as X, _ as ee, ab as x, am as te, ar as ae, aw as ne, au as le, l as se, a5 as oe } from "./index-ex9E0DB9.js";
const ue = { key: 0, class: "center" }, de = { key: 0 }, ce = { key: 1 }, re = { class: "left" }, ie = ["innerHTML"], _e = { key: 1, style: { border: "1px solid #ccc" } }, me = { __name: "SendMail", setup(pe) {
  const c = H(), v = se(false), y = $(), { settings: _, sendMailModel: t, indexTab: k, userSettings: w } = I(), { t: l } = F({ locale: "zh", messages: { en: { successSend: "Please check your sendbox. If failed, please check your balance or try again later.", fromName: "Your Name and Address, leave Name blank to use email address", toName: "Recipient Name and Address, leave Name blank to use email address", subject: "Subject", options: "Options", edit: "Edit", preview: "Preview", content: "Content", send: "Send", requestAccess: "Request Access", requestAccessTip: "You need to request access to send mail, if have request, please contact admin.", send_balance: "Send Mail Balance Left", text: "Text", html: "HTML", "rich text": "Rich Text", tooLarge: "Too large file, please upload file less than 1MB." }, zh: { successSend: "\u8BF7\u67E5\u770B\u60A8\u7684\u53D1\u4EF6\u7BB1, \u5982\u679C\u5931\u8D25, \u8BF7\u68C0\u67E5\u60A8\u7684\u4F59\u989D\u6216\u7A0D\u540E\u91CD\u8BD5\u3002", fromName: "\u4F60\u7684\u540D\u79F0\u548C\u5730\u5740\uFF0C\u540D\u79F0\u4E0D\u586B\u5199\u5219\u4F7F\u7528\u90AE\u7BB1\u5730\u5740", toName: "\u6536\u4EF6\u4EBA\u540D\u79F0\u548C\u5730\u5740\uFF0C\u540D\u79F0\u4E0D\u586B\u5199\u5219\u4F7F\u7528\u90AE\u7BB1\u5730\u5740", subject: "\u4E3B\u9898", options: "\u9009\u9879", edit: "\u7F16\u8F91", preview: "\u9884\u89C8", content: "\u5185\u5BB9", send: "\u53D1\u9001", requestAccess: "\u7533\u8BF7\u6743\u9650", requestAccessTip: "\u60A8\u9700\u8981\u7533\u8BF7\u6743\u9650\u624D\u80FD\u53D1\u9001\u90AE\u4EF6, \u5982\u679C\u5DF2\u7ECF\u7533\u8BF7\u8FC7, \u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u63D0\u5347\u989D\u5EA6\u3002", send_balance: "\u5269\u4F59\u53D1\u9001\u90AE\u4EF6\u989D\u5EA6", text: "\u6587\u672C", html: "HTML", "rich text": "\u5BCC\u6587\u672C", tooLarge: "\u6587\u4EF6\u8FC7\u5927, \u8BF7\u4E0A\u4F20\u5C0F\u4E8E1MB\u7684\u6587\u4EF6\u3002" } } }), C = [{ label: l("text"), value: "text" }, { label: l("html"), value: "html" }, { label: l("rich text"), value: "rich" }], q = async () => {
    try {
      await p.fetch("/api/send_mail", { method: "POST", body: JSON.stringify({ from_name: t.value.fromName, to_name: t.value.toName, to_mail: t.value.toMail, subject: t.value.subject, is_html: t.value.contentType != "text", content: t.value.content }) }), t.value = { fromName: "", toName: "", toMail: "", subject: "", contentType: "text", content: "" };
    } catch (u) {
      c.error(u.message || "error");
    } finally {
      c.success(l("successSend")), k.value = "sendbox";
    }
  }, L = async () => {
    try {
      await p.fetch("/api/requset_send_mail_access", { method: "POST", body: JSON.stringify({}) }), c.success(l("success")), await p.getSettings();
    } catch (u) {
      c.error(u.message || "error");
    }
  }, U = { excludeKeys: ["uploadVideo"] }, j = { MENU_CONF: { uploadImage: { async customUpload() {
    c.error(l("tooLarge"));
  }, maxFileSize: 1 * 1024 * 1024, base64LimitSize: 1 * 1024 * 1024 } } };
  J(() => {
    const u = y.value;
    u == null ? void 0 : u.destroy();
  });
  const A = (u) => {
    y.value = u;
  };
  return D(async () => {
    w.value.user_id || await p.getUserSettings(c), await p.getSettings();
  }), (u, o) => {
    const g = K, N = G, B = Q, r = ee, T = X, m = W, V = le, O = te, h = oe, R = Z;
    return e(_).address ? (d(), f("div", ue, [a(h, { bordered: false, embedded: "" }, { default: s(() => [!e(_).send_balance || e(_).send_balance <= 0 ? (d(), f("div", de, [a(N, { type: "warning", "show-icon": false, bordered: false }, { default: s(() => [b(i(e(l)("requestAccessTip")) + " ", 1), a(g, { type: "primary", tertiary: "", onClick: L, size: "small" }, { default: s(() => [b(i(e(l)("requestAccess")), 1)]), _: 1 })]), _: 1 }), a(Y)])) : (d(), f("div", ce, [a(N, { type: "info", "show-icon": false, bordered: false, closable: "" }, { default: s(() => [b(i(e(l)("send_balance")) + ": " + i(e(_).send_balance), 1)]), _: 1 }), a(B, { justify: "end" }, { default: s(() => [a(g, { type: "primary", onClick: q }, { default: s(() => [b(i(e(l)("send")), 1)]), _: 1 })]), _: 1 }), M("div", re, [a(R, { model: e(t) }, { default: s(() => [a(m, { label: e(l)("fromName"), "label-placement": "top" }, { default: s(() => [a(T, null, { default: s(() => [a(r, { value: e(t).fromName, "onUpdate:value": o[0] || (o[0] = (n) => e(t).fromName = n) }, null, 8, ["value"]), a(r, { value: e(_).address, disabled: "" }, null, 8, ["value"])]), _: 1 })]), _: 1 }, 8, ["label"]), a(m, { label: e(l)("toName"), "label-placement": "top" }, { default: s(() => [a(T, null, { default: s(() => [a(r, { value: e(t).toName, "onUpdate:value": o[1] || (o[1] = (n) => e(t).toName = n) }, null, 8, ["value"]), a(r, { value: e(t).toMail, "onUpdate:value": o[2] || (o[2] = (n) => e(t).toMail = n) }, null, 8, ["value"])]), _: 1 })]), _: 1 }, 8, ["label"]), a(m, { label: e(l)("subject"), "label-placement": "top" }, { default: s(() => [a(r, { value: e(t).subject, "onUpdate:value": o[3] || (o[3] = (n) => e(t).subject = n) }, null, 8, ["value"])]), _: 1 }, 8, ["label"]), a(m, { label: e(l)("options"), "label-placement": "top" }, { default: s(() => [a(O, { value: e(t).contentType, "onUpdate:value": o[4] || (o[4] = (n) => e(t).contentType = n) }, { default: s(() => [(d(), f(ae, null, ne(C, (n) => a(V, { key: n.value, value: n.value, label: n.label }, null, 8, ["value", "label"])), 64))]), _: 1 }, 8, ["value"]), e(t).contentType != "text" ? (d(), x(g, { key: 0, onClick: o[5] || (o[5] = (n) => v.value = !v.value), style: { "margin-left": "10px" } }, { default: s(() => [b(i(v.value ? e(l)("edit") : e(l)("preview")), 1)]), _: 1 })) : S("", true)]), _: 1 }, 8, ["label"]), a(m, { label: e(l)("content"), "label-placement": "top" }, { default: s(() => [v.value ? (d(), x(h, { key: 0, bordered: false, embedded: "" }, { default: s(() => [M("div", { innerHTML: e(t).content }, null, 8, ie)]), _: 1 })) : e(t).contentType == "rich" ? (d(), f("div", _e, [a(e(z), { style: { "border-bottom": "1px solid #ccc" }, defaultConfig: U, editor: y.value, mode: "default" }, null, 8, ["editor"]), a(e(E), { style: { height: "500px", "overflow-y": "hidden" }, modelValue: e(t).content, "onUpdate:modelValue": o[6] || (o[6] = (n) => e(t).content = n), defaultConfig: j, mode: "default", onOnCreated: A }, null, 8, ["modelValue"])])) : (d(), x(r, { key: 2, type: "textarea", value: e(t).content, "onUpdate:value": o[7] || (o[7] = (n) => e(t).content = n), autosize: { minRows: 3 } }, null, 8, ["value"]))]), _: 1 }, 8, ["label"])]), _: 1 }, 8, ["model"])])]))]), _: 1 })])) : S("", true);
  };
} }, ve = P(me, [["__scopeId", "data-v-14e4556d"]]);
export {
  ve as default
};
