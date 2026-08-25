// @bun
// src/tui/box.tsx
import { createComponent as _$createComponent2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { spawn } from "child_process";
import { unwatchFile, watchFile } from "fs";
import { homedir as homedir3 } from "os";
import { join as join3 } from "path";
import { createSignal as createSignal2 } from "opentui:runtime-module:solid-js";

// src/box-state.ts
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
var sandboxBehaviours = ["write", "read", "webfetch", "shell"];
var defaultSandboxState = {
  read: true,
  write: true,
  webfetch: true,
  shell: true
};
var sandboxStatePath = join(homedir(), ".nwb", "boxedcode", "sandbox.json");
async function readSandboxState(path = sandboxStatePath) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!isRecord(value))
      return {
        ...defaultSandboxState
      };
    if (sandboxBehaviours.some((behaviour) => value[behaviour] !== undefined && typeof value[behaviour] !== "boolean")) {
      return {
        ...defaultSandboxState
      };
    }
    return Object.fromEntries(sandboxBehaviours.map((behaviour) => [behaviour, typeof value[behaviour] === "boolean" ? value[behaviour] : true]));
  } catch {
    return {
      ...defaultSandboxState
    };
  }
}
async function updateSandboxState(behaviour, enabled, path = sandboxStatePath) {
  const state = {
    ...await readSandboxState(path),
    [behaviour]: enabled
  };
  const directory = dirname(path);
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await mkdir(directory, {
    recursive: true
  });
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}
`, {
      mode: 384
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, {
      force: true
    });
    throw error;
  }
  return state;
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// src/tui/sidebar-quota.tsx
import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
import { readFile as readFile2 } from "fs/promises";
import { Show, createSignal, onCleanup, onMount } from "opentui:runtime-module:solid-js";

// src/quota-data.ts
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
var quotaPath = join2(homedir2(), ".boxedcode-pro", "quota.json");
function formatDollarsFromCents(value) {
  return value.status === "available" ? `$${(value.cents / 100).toFixed(2)}` : "N/A";
}

// src/tui/sidebar-quota.tsx
var refreshIntervalMs = 1000;
async function readMonthlySpentCents() {
  try {
    return JSON.parse(await readFile2(quotaPath, "utf8"));
  } catch {
    return {
      status: "unavailable"
    };
  }
}
function SidebarQuota(props) {
  const [open, setOpen] = createSignal(true);
  const [spend, setSpend] = createSignal();
  let timer;
  let disposed = false;
  const refresh = async () => {
    const value = await readMonthlySpentCents();
    if (disposed)
      return;
    setSpend(value);
    timer = setTimeout(() => void refresh(), refreshIntervalMs);
  };
  onMount(() => void refresh());
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
  });
  const line = () => {
    const value = spend();
    if (!value)
      return "";
    return value.status === "available" ? `${formatDollarsFromCents(value)} spent` : formatDollarsFromCents(value);
  };
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$3 = _$createElement("text"), _el$4 = _$createElement("text"), _el$5 = _$createElement("b");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$4);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "gap", 1);
    _$setProp(_el$2, "onMouseDown", () => setOpen((value) => !value));
    _$insert(_el$3, () => open() ? "\u25BC" : "\u25B6");
    _$insertNode(_el$4, _el$5);
    _$insertNode(_el$5, _$createTextNode(`Monthly Copilot Spend`));
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return open();
      },
      get children() {
        var _el$7 = _$createElement("text");
        _$insert(_el$7, line);
        _$effect((_$p) => _$setProp(_el$7, "fg", props.context.theme.text.subdued, _$p));
        return _el$7;
      }
    }), null);
    _$effect((_p$) => {
      var _v$ = props.context.theme.text.default, _v$2 = props.context.theme.text.default;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
}

// src/tui/box.tsx
var settingsPath = join3(homedir3(), ".nwb", "box", "box.json");
function SandboxControls(props) {
  const theme = () => props.context.theme;
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("box"), _el$3 = _$createElement2("text"), _el$4 = _$createElement2("text"), _el$5 = _$createElement2("b");
    _$insertNode2(_el$, _el$2);
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$2, _el$4);
    _$setProp2(_el$2, "flexDirection", "row");
    _$setProp2(_el$2, "gap", 1);
    _$insert2(_el$3, () => props.open() ? "\u25BC" : "\u25B6");
    _$insertNode2(_el$4, _el$5);
    _$insertNode2(_el$5, _$createTextNode2(`Sandbox`));
    _$insert2(_el$, [_$memo2(() => (props.open() ? sandboxBehaviours : sandboxBehaviours.filter((behaviour) => !props.state()[behaviour])).map((behaviour) => (() => {
      var _el$7 = _$createElement2("text"), _el$8 = _$createElement2("span"), _el$0 = _$createTextNode2(` `), _el$1 = _$createTextNode2(` `), _el$10 = _$createElement2("span");
      _$insertNode2(_el$7, _el$8);
      _$insertNode2(_el$7, _el$0);
      _$insertNode2(_el$7, _el$1);
      _$insertNode2(_el$7, _el$10);
      _$setProp2(_el$7, "onMouseDown", () => props.toggle(behaviour));
      _$insertNode2(_el$8, _$createTextNode2(`\u2022`));
      _$insert2(_el$7, behaviour, _el$1);
      _$insert2(_el$10, (() => {
        var _c$ = _$memo2(() => props.state().updating === behaviour);
        return () => _c$() ? "\u2026" : props.state()[behaviour] ? "" : "Disabled";
      })());
      _$effect2((_p$) => {
        var _v$4 = props.state()[behaviour] ? theme().text.default : theme().text.feedback.error.default, _v$5 = {
          fg: props.state()[behaviour] ? theme().text.feedback.success.default : theme().text.feedback.error.default
        }, _v$6 = {
          fg: theme().text.subdued
        };
        _v$4 !== _p$.e && (_p$.e = _$setProp2(_el$7, "fg", _v$4, _p$.e));
        _v$5 !== _p$.t && (_p$.t = _$setProp2(_el$8, "style", _v$5, _p$.t));
        _v$6 !== _p$.a && (_p$.a = _$setProp2(_el$10, "style", _v$6, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
      return _el$7;
    })())), _$memo2(() => _$memo2(() => !!props.open())() && (() => {
      var _el$11 = _$createElement2("text");
      _$insertNode2(_el$11, _$createTextNode2(`\u2699 edit box.json`));
      _$effect2((_p$) => {
        var _v$7 = theme().text.subdued, _v$8 = props.openSettings;
        _v$7 !== _p$.e && (_p$.e = _$setProp2(_el$11, "fg", _v$7, _p$.e));
        _v$8 !== _p$.t && (_p$.t = _$setProp2(_el$11, "onMouseDown", _v$8, _p$.t));
        return _p$;
      }, {
        e: undefined,
        t: undefined
      });
      return _el$11;
    })())], null);
    _$effect2((_p$) => {
      var _v$ = props.toggleOpen, _v$2 = theme().text.default, _v$3 = theme().text.default;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$2, "onMouseDown", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$3, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp2(_el$4, "fg", _v$3, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$;
  })();
}
async function openSettings(context) {
  const editor = process.env["VISUAL"] || process.env["EDITOR"];
  if (!editor)
    throw new Error("Set $VISUAL or $EDITOR to open settings");
  context.renderer.suspend();
  context.renderer.currentRenderBuffer.clear();
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(editor, [settingsPath], {
        stdio: "inherit",
        shell: true
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (code === 0)
          resolve();
        else
          reject(new Error(`Editor exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
      });
    });
  } finally {
    context.renderer.currentRenderBuffer.clear();
    context.renderer.resume();
    context.renderer.requestRender();
  }
}
async function setupSandboxControls(context) {
  const [state, setState] = createSignal2({
    ...await readSandboxState(),
    updating: undefined
  });
  const [preferences, updatePreferences] = context.storage.store("sandbox", {
    initial: {
      open: false
    }
  });
  const [open, setOpen] = createSignal2(preferences.open);
  const refresh = async () => {
    const next = await readSandboxState();
    setState((current) => ({
      ...next,
      updating: current.updating
    }));
  };
  const stateChanged = () => void refresh();
  const toggle = async (behaviour) => {
    const current = state();
    if (current.updating)
      return;
    setState({
      ...current,
      updating: behaviour
    });
    try {
      const next = await updateSandboxState(behaviour, !current[behaviour]);
      setState({
        ...next,
        updating: behaviour
      });
    } catch (error) {
      context.ui.toast.show({
        title: "Sandbox controls",
        message: error instanceof Error ? error.message : String(error),
        variant: "error"
      });
    } finally {
      setState((current2) => ({
        ...current2,
        updating: undefined
      }));
    }
  };
  const toggleOpen = async () => {
    const nextOpen = !open();
    setOpen(nextOpen);
    try {
      await updatePreferences((draft) => {
        draft.open = nextOpen;
      });
    } catch (error) {
      context.ui.toast.show({
        title: "Sandbox controls",
        message: error instanceof Error ? error.message : String(error),
        variant: "error"
      });
    }
  };
  const unregister = context.ui.slot({
    append: "sidebar.content",
    render: () => [_$createComponent2(SandboxControls, {
      context,
      state,
      open,
      toggleOpen: () => void toggleOpen(),
      toggle: (behaviour) => void toggle(behaviour),
      openSettings: () => void openSettings(context).catch((error) => context.ui.toast.show({
        title: "Sandbox settings",
        message: error instanceof Error ? error.message : String(error),
        variant: "error"
      }))
    }), _$createComponent2(SidebarQuota, {
      context
    })]
  });
  watchFile(sandboxStatePath, {
    interval: 500
  }, stateChanged);
  return () => {
    unregister();
    unwatchFile(sandboxStatePath, stateChanged);
  };
}

// src/tui/report.tsx
import { insert as _$insert3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { readFileSync } from "fs";
import { homedir as homedir4 } from "os";
import { join as join4 } from "path";
import { For, Show as Show2, createMemo, createSignal as createSignal3 } from "opentui:runtime-module:solid-js";

// src/tui/report-data.ts
function buildSessionReport(sessionIDs, reports, models, system) {
  const totals = {
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    cost: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cacheRebilled: 0,
    cacheRebilledCost: 0,
    cacheMisses: 0,
    inputCost: 0,
    outputCost: 0,
    models: new Map
  };
  for (const messages of reports) {
    let previousCacheRead;
    for (const message of messages) {
      if (message.type === "user")
        totals.userMessages += 1;
      if (message.type !== "assistant" || !("content" in message))
        continue;
      const tokens = message.tokens;
      const cost = message.cost ?? 0;
      totals.assistantMessages += 1;
      totals.toolCalls += message.content.filter((part) => part.type === "tool").length;
      totals.cost += cost;
      if (!tokens)
        continue;
      totals.input += tokens.input;
      totals.output += tokens.output;
      totals.cacheRead += tokens.cache.read;
      totals.cacheWrite += tokens.cache.write;
      const modelName = `${message.model.providerID}/${message.model.id}`;
      const model = totals.models.get(modelName) ?? {
        name: modelName,
        cost: 0,
        tokens: 0
      };
      model.cost += cost;
      model.tokens += tokens.input + tokens.output;
      totals.models.set(modelName, model);
      const rates = models.find((item) => item.providerID === message.model.providerID && item.modelID === message.model.id)?.cost[0];
      if (rates) {
        const inputCost = tokens.input * rates.input + tokens.cache.read * rates.cache.read + tokens.cache.write * rates.cache.write;
        const outputCost = tokens.output * rates.output;
        const pricedCost = inputCost + outputCost;
        if (pricedCost > 0) {
          totals.inputCost += cost * (inputCost / pricedCost);
          totals.outputCost += cost * (outputCost / pricedCost);
        }
      }
      if (previousCacheRead !== undefined && tokens.cache.read < previousCacheRead) {
        totals.cacheRebilled += tokens.input;
        totals.cacheRebilledCost += tokens.input * (rates?.input ?? 0) / 1e6;
        totals.cacheMisses += 1;
      }
      previousCacheRead = tokens.cache.read;
    }
  }
  return {
    ...totals,
    sessionIDs: [...sessionIDs],
    models: [...totals.models.values()],
    system
  };
}
var formatReportNumber = (value) => new Intl.NumberFormat("en-US").format(value);

// src/tui/report.tsx
var reportRouteName = "boxedcode.report";
function setupReport(context) {
  context.ui.router.register({
    name: reportRouteName,
    render: ({
      data
    }) => {
      const sessionID = data?.["sessionID"];
      if (typeof sessionID !== "string")
        return (() => {
          var _el$ = _$createElement3("text");
          _$insertNode3(_el$, _$createTextNode3(`Open /report from a session route.`));
          _$effect3((_$p) => _$setProp3(_el$, "fg", context.theme.text.feedback.error.default, _$p));
          return _el$;
        })();
      return _$createComponent3(Report, {
        context,
        sessionID
      });
    }
  });
  context.ui.slot({
    append: "app",
    render: () => {
      context.keymap.layer(() => ({
        mode: "global",
        commands: [{
          id: "boxedcode.report.open",
          title: "Session Report",
          description: "Show session cost, token, cache usage, tools and system prompt",
          group: "Plugin",
          palette: true,
          slash: {
            name: "report"
          },
          suggested: () => context.ui.router.current().type === "session",
          enabled: () => context.ui.router.current().type === "session",
          run: () => {
            const route = context.ui.router.current();
            if (route.type !== "session")
              return;
            context.ui.router.navigate({
              type: "plugin",
              name: reportRouteName,
              data: {
                sessionID: route.sessionID
              }
            });
            context.ui.dialog.clear();
          }
        }]
      }));
      return null;
    }
  });
}
function Report(props) {
  const system = createMemo(() => readSystemData(props.sessionID));
  const sessionIDs = createMemo(() => descendants(props.context.data, props.sessionID));
  const report = createMemo(() => buildSessionReport(sessionIDs(), sessionIDs().map((id) => props.context.data.session.message.list(id)), props.context.data.location.model.list(props.context.location) ?? [], system()));
  const theme = () => props.context.theme;
  const navigateToSession = (sessionID) => props.context.ui.router.navigate({
    type: "session",
    sessionID
  });
  const navigateToReport = (sessionID) => props.context.ui.router.navigate({
    type: "plugin",
    name: reportRouteName,
    data: {
      sessionID
    }
  });
  const navigateBack = () => {
    const parentID = props.context.data.session.get(props.sessionID)?.parentID;
    if (parentID)
      navigateToReport(parentID);
    else
      navigateToSession(props.sessionID);
  };
  props.context.keymap.layer(() => ({
    commands: [{
      bind: "escape",
      title: "Back to session",
      group: "Report",
      run: navigateBack
    }]
  }));
  return (() => {
    var _el$3 = _$createElement3("box"), _el$4 = _$createElement3("box"), _el$5 = _$createElement3("text"), _el$6 = _$createElement3("b"), _el$8 = _$createElement3("text"), _el$0 = _$createElement3("scrollbox"), _el$1 = _$createElement3("box");
    _$insertNode3(_el$3, _el$4);
    _$insertNode3(_el$3, _el$0);
    _$setProp3(_el$3, "flexDirection", "column");
    _$setProp3(_el$3, "width", "100%");
    _$setProp3(_el$3, "height", "100%");
    _$setProp3(_el$3, "paddingLeft", 1);
    _$setProp3(_el$3, "paddingRight", 1);
    _$setProp3(_el$3, "paddingBottom", 1);
    _$setProp3(_el$3, "gap", 1);
    _$insertNode3(_el$4, _el$5);
    _$insertNode3(_el$4, _el$8);
    _$setProp3(_el$4, "flexDirection", "row");
    _$setProp3(_el$4, "justifyContent", "space-between");
    _$setProp3(_el$4, "padding", 1);
    _$insertNode3(_el$5, _el$6);
    _$insertNode3(_el$6, _$createTextNode3(`Session Report`));
    _$insertNode3(_el$8, _$createTextNode3(`esc back`));
    _$insertNode3(_el$0, _el$1);
    _$setProp3(_el$0, "flexGrow", 1);
    _$setProp3(_el$0, "minHeight", 0);
    _$setProp3(_el$1, "flexDirection", "column");
    _$setProp3(_el$1, "gap", 1);
    _$insert3(_el$1, _$createComponent3(ReportSection, {
      theme,
      title: "Tokens",
      get children() {
        return [_$createComponent3(ReportLine, {
          theme,
          label: "Input",
          get value() {
            return formatReportNumber(report().input + report().cacheRead);
          }
        }), (() => {
          var _el$10 = _$createElement3("box");
          _$setProp3(_el$10, "paddingLeft", 2);
          _$insert3(_el$10, _$createComponent3(ReportLine, {
            theme,
            label: "Cached",
            get value() {
              return `${formatReportNumber(report().cacheRead)} (${cachePercent(report())}%)`;
            }
          }), null);
          _$insert3(_el$10, _$createComponent3(Show2, {
            get when() {
              return report().cacheWrite > 0;
            },
            get children() {
              return _$createComponent3(ReportLine, {
                theme,
                label: "Cache written",
                get value() {
                  return formatReportNumber(report().cacheWrite);
                }
              });
            }
          }), null);
          _$insert3(_el$10, _$createComponent3(Show2, {
            get when() {
              return report().cacheMisses > 0;
            },
            get children() {
              return _$createComponent3(ReportLine, {
                theme,
                label: "Cache re-billed",
                get value() {
                  return `${formatReportNumber(report().cacheRebilled)} tokens, $${report().cacheRebilledCost.toFixed(2)} (${report().cacheMisses} misses)`;
                }
              });
            }
          }), null);
          return _el$10;
        })(), _$createComponent3(ReportLine, {
          theme,
          label: "Output",
          get value() {
            return formatReportNumber(report().output);
          }
        }), _$createComponent3(ReportLine, {
          theme,
          label: "Total",
          get value() {
            return formatReportNumber(report().input + report().cacheRead + report().output);
          }
        })];
      }
    }), null);
    _$insert3(_el$1, _$createComponent3(ReportSection, {
      theme,
      title: "Cost",
      get children() {
        return [_$createComponent3(ReportLine, {
          theme,
          label: "Total",
          get value() {
            return `$${report().cost.toFixed(2)}`;
          }
        }), _$createComponent3(Show2, {
          get when() {
            return report().inputCost + report().outputCost > 0;
          },
          get children() {
            return [_$createComponent3(ReportLine, {
              theme,
              label: "Input",
              get value() {
                return `$${report().inputCost.toFixed(2)} (${costPercent(report().inputCost, report().cost)}%)`;
              }
            }), _$createComponent3(ReportLine, {
              theme,
              label: "Output",
              get value() {
                return `$${report().outputCost.toFixed(2)} (${costPercent(report().outputCost, report().cost)}%)`;
              }
            })];
          }
        })];
      }
    }), null);
    _$insert3(_el$1, _$createComponent3(ReportSection, {
      theme,
      title: "Models",
      get children() {
        return _$createComponent3(For, {
          get each() {
            return report().models;
          },
          children: (model) => _$createComponent3(ReportLine, {
            theme,
            get label() {
              return model.name;
            },
            get value() {
              return `$${model.cost.toFixed(2)} (${formatReportNumber(model.tokens)} tokens)`;
            }
          })
        });
      }
    }), null);
    _$insert3(_el$1, _$createComponent3(ReportSection, {
      theme,
      title: "Messages",
      get children() {
        return [_$createComponent3(ReportLine, {
          theme,
          label: "User",
          get value() {
            return formatReportNumber(report().userMessages);
          }
        }), _$createComponent3(ReportLine, {
          theme,
          label: "Assistant",
          get value() {
            return formatReportNumber(report().assistantMessages);
          }
        }), _$createComponent3(ReportLine, {
          theme,
          label: "Tool calls",
          get value() {
            return formatReportNumber(report().toolCalls);
          }
        })];
      }
    }), null);
    _$insert3(_el$1, _$createComponent3(ReportSection, {
      theme,
      title: "Sessions",
      get children() {
        return _$createComponent3(For, {
          get each() {
            return report().sessionIDs;
          },
          children: (sessionID) => (() => {
            var _el$11 = _$createElement3("box"), _el$12 = _$createElement3("text"), _el$13 = _$createElement3("text"), _el$14 = _$createElement3("u");
            _$insertNode3(_el$11, _el$12);
            _$insertNode3(_el$11, _el$13);
            _$setProp3(_el$11, "flexDirection", "row");
            _$setProp3(_el$11, "gap", 1);
            _$setProp3(_el$12, "onMouseDown", () => navigateToReport(sessionID));
            _$insert3(_el$12, `- ${sessionID}`);
            _$insertNode3(_el$13, _el$14);
            _$setProp3(_el$13, "onMouseDown", () => navigateToSession(sessionID));
            _$insertNode3(_el$14, _$createTextNode3(`view`));
            _$effect3((_p$) => {
              var _v$5 = theme().text.action.primary.default, _v$6 = theme().text.feedback.info.default;
              _v$5 !== _p$.e && (_p$.e = _$setProp3(_el$12, "fg", _v$5, _p$.e));
              _v$6 !== _p$.t && (_p$.t = _$setProp3(_el$13, "fg", _v$6, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$11;
          })()
        });
      }
    }), null);
    _$insert3(_el$1, _$createComponent3(Show2, {
      get when() {
        return report().system;
      },
      get fallback() {
        return _$createComponent3(ReportSection, {
          theme,
          title: "Request details",
          get children() {
            var _el$16 = _$createElement3("text");
            _$insertNode3(_el$16, _$createTextNode3(`Not available`));
            _$effect3((_$p) => _$setProp3(_el$16, "fg", theme().text.subdued, _$p));
            return _el$16;
          }
        });
      },
      keyed: true,
      children: (value) => _$createComponent3(SystemDetails, {
        theme,
        system: value
      })
    }), null);
    _$effect3((_p$) => {
      var _v$ = theme().background.default, _v$2 = theme().background.surface.offset, _v$3 = theme().text.action.primary.default, _v$4 = theme().text.subdued;
      _v$ !== _p$.e && (_p$.e = _$setProp3(_el$3, "backgroundColor", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp3(_el$4, "backgroundColor", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp3(_el$5, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp3(_el$8, "fg", _v$4, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$3;
  })();
}
function ReportSection(props) {
  return (() => {
    var _el$18 = _$createElement3("box"), _el$19 = _$createElement3("text"), _el$20 = _$createElement3("b");
    _$insertNode3(_el$18, _el$19);
    _$setProp3(_el$18, "paddingLeft", 1);
    _$setProp3(_el$18, "paddingRight", 1);
    _$setProp3(_el$18, "paddingTop", 1);
    _$insertNode3(_el$19, _el$20);
    _$insert3(_el$20, () => props.title);
    _$insert3(_el$18, () => props.children, null);
    _$effect3((_p$) => {
      var _v$7 = props.theme().background.surface.offset, _v$8 = props.theme().text.feedback.info.default;
      _v$7 !== _p$.e && (_p$.e = _$setProp3(_el$18, "backgroundColor", _v$7, _p$.e));
      _v$8 !== _p$.t && (_p$.t = _$setProp3(_el$19, "fg", _v$8, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$18;
  })();
}
function ReportLine(props) {
  return (() => {
    var _el$21 = _$createElement3("box"), _el$22 = _$createElement3("text"), _el$23 = _$createTextNode3(`: `), _el$24 = _$createElement3("text");
    _$insertNode3(_el$21, _el$22);
    _$insertNode3(_el$21, _el$24);
    _$setProp3(_el$21, "flexDirection", "row");
    _$insertNode3(_el$22, _el$23);
    _$insert3(_el$22, () => props.label, _el$23);
    _$insert3(_el$24, () => props.value);
    _$effect3((_p$) => {
      var _v$9 = props.theme().text.subdued, _v$0 = props.theme().text.default;
      _v$9 !== _p$.e && (_p$.e = _$setProp3(_el$22, "fg", _v$9, _p$.e));
      _v$0 !== _p$.t && (_p$.t = _$setProp3(_el$24, "fg", _v$0, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$21;
  })();
}
function SystemDetails(props) {
  const prompt = Array.isArray(props.system.prompt) ? props.system.prompt.filter((item) => typeof item === "string") : [];
  const tools = Array.isArray(props.system.tools) ? props.system.tools : [];
  return [_$createComponent3(ReportSection, {
    get theme() {
      return props.theme;
    },
    title: "Tools (from 1st request)",
    get children() {
      return _$createComponent3(Show2, {
        get when() {
          return tools.length > 0;
        },
        get fallback() {
          return (() => {
            var _el$25 = _$createElement3("text");
            _$insertNode3(_el$25, _$createTextNode3(`-`));
            _$effect3((_$p) => _$setProp3(_el$25, "fg", props.theme().text.subdued, _$p));
            return _el$25;
          })();
        },
        get children() {
          return _$createComponent3(For, {
            each: tools,
            children: (tool, index) => _$createComponent3(Tool, {
              get theme() {
                return props.theme;
              },
              tool,
              get index() {
                return index();
              }
            })
          });
        }
      });
    }
  }), _$createComponent3(ReportSection, {
    get theme() {
      return props.theme;
    },
    title: "System prompt (from 1st request)",
    get children() {
      return _$createComponent3(Show2, {
        get when() {
          return prompt.length > 0;
        },
        get fallback() {
          return (() => {
            var _el$27 = _$createElement3("text");
            _$insertNode3(_el$27, _$createTextNode3(`-`));
            _$effect3((_$p) => _$setProp3(_el$27, "fg", props.theme().text.subdued, _$p));
            return _el$27;
          })();
        },
        get children() {
          return _$createComponent3(For, {
            each: prompt,
            children: (item) => (() => {
              var _el$29 = _$createElement3("text");
              _$insert3(_el$29, item);
              _$effect3((_$p) => _$setProp3(_el$29, "fg", props.theme().text.subdued, _$p));
              return _el$29;
            })()
          });
        }
      });
    }
  })];
}
function Tool(props) {
  const [open, setOpen] = createSignal3(false);
  const name = props.tool && typeof props.tool === "object" && "name" in props.tool && typeof props.tool.name === "string" ? props.tool.name : `Tool ${props.index + 1}`;
  return (() => {
    var _el$30 = _$createElement3("box"), _el$31 = _$createElement3("text");
    _$insertNode3(_el$30, _el$31);
    _$setProp3(_el$31, "onMouseDown", () => setOpen((value) => !value));
    _$insert3(_el$31, name);
    _$insert3(_el$30, _$createComponent3(Show2, {
      get when() {
        return open();
      },
      get children() {
        var _el$32 = _$createElement3("text");
        _$insert3(_el$32, () => JSON.stringify(props.tool, null, 2)?.replaceAll("\\n", `
`));
        _$effect3((_$p) => _$setProp3(_el$32, "fg", props.theme().text.subdued, _$p));
        return _el$32;
      }
    }), null);
    _$effect3((_$p) => _$setProp3(_el$31, "fg", props.theme().text.default, _$p));
    return _el$30;
  })();
}
var cachePercent = (report) => {
  const input = report.input + report.cacheRead;
  return input === 0 ? "0.0" : (report.cacheRead / input * 100).toFixed(1);
};
var costPercent = (value, total) => total === 0 ? "0.0" : (value / total * 100).toFixed(1);
function descendants(data, sessionID) {
  const children = data.session.list().filter((session) => session.parentID === sessionID);
  return [sessionID, ...children.flatMap((child) => descendants(data, child.id))];
}
function readSystemData(sessionID) {
  try {
    return JSON.parse(readFileSync(join4(homedir4(), ".boxedcode-pro", "share", `${sessionID}.json`), "utf8"));
  } catch {
    return;
  }
}

// src/tui.tsx
var tui_default = {
  id: "boxedcode",
  setup(context) {
    setupReport(context);
    return setupSandboxControls(context);
  }
};
export {
  tui_default as default
};
