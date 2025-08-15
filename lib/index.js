"use strict";
Object.defineProperty(exports, "__esModule", { value: !0 });
var jsxRuntime = require("react/jsx-runtime"), reactPropsStream = require("react-props-stream"), operators = require("rxjs/operators"), rxjs = require("rxjs"), AbortControllerPolyfill = require("abort-controller"), react = require("react"), ui = require("@sanity/ui"), dashboard = require("@sanity/dashboard"), styledComponents = require("styled-components");
function _interopDefaultCompat(e) {
  return e && typeof e == "object" && "default" in e ? e : { default: e };
}
var AbortControllerPolyfill__default = /* @__PURE__ */ _interopDefaultCompat(AbortControllerPolyfill);
const createAbortController = () => "AbortController" in window ? new AbortController() : new AbortControllerPolyfill__default.default(), statusCodeRequest = (input, init) => new rxjs.Observable((subscriber) => {
  const controller = createAbortController(), onResponse = (res) => {
    subscriber.next(res), subscriber.complete();
  }, onError = (err) => {
    err.name === "AbortError" ? subscriber.complete() : subscriber.error(err);
  };
  return fetch(input, { ...init, signal: controller.signal }).then((res) => {
    if (res.status < 200 || res.status > 299)
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    return res.status;
  }).then(onResponse, onError), () => {
    controller.abort();
  };
}), jsonRequest = (input, init) => new rxjs.Observable((subscriber) => {
  const controller = createAbortController(), onResponse = (res) => {
    subscriber.next(res), subscriber.complete();
  }, onError = (err) => {
    err.name === "AbortError" ? subscriber.complete() : subscriber.error(err);
  };
  return fetch(input, { ...init, signal: controller.signal }).then((res) => {
    if (res.status < 200 || res.status > 299)
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    return res.json();
  }).then(onResponse, onError), () => {
    controller.abort();
  };
}), CORS_PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://cors-anywhere.herokuapp.com/"
];
function deploy(site, accessToken, proxyUrl) {
  if (!site.buildHookId)
    return rxjs.of(new Error("Site missing buildHookId"));
  const url = proxyUrl ? `${proxyUrl}/build_hooks/${site.buildHookId}` : `https://api.netlify.com/build_hooks/${site.buildHookId}`, headers = {};
  return accessToken && (headers.Authorization = `Bearer ${accessToken}`), statusCodeRequest(url, {
    method: "POST",
    headers
  }).pipe(operators.map((result) => ({ result, site })));
}
function tryCorsProxy(netlifyUrl, accessToken, proxyIndex = 0) {
  if (proxyIndex >= CORS_PROXIES.length)
    return console.warn("All CORS proxies failed. Deploy history unavailable."), rxjs.of([]);
  const url = `${CORS_PROXIES[proxyIndex]}${encodeURIComponent(netlifyUrl)}`, headers = {
    "Content-Type": "application/json"
  };
  return accessToken && (headers.Authorization = `Bearer ${accessToken}`), jsonRequest(url, {
    method: "GET",
    headers
  }).pipe(
    operators.map((deploys) => Array.isArray(deploys) ? deploys.filter(
      (deployItem) => deployItem && typeof deployItem == "object" && deployItem.id && deployItem.createdAt
    ).slice(0, 10).map((deployItem) => {
      const createdAt = deployItem.createdAt ? new Date(deployItem.createdAt) : null, publishedAt = deployItem.publishedAt ? new Date(deployItem.publishedAt) : null;
      let buildTime;
      return createdAt && publishedAt && !isNaN(createdAt.getTime()) && !isNaN(publishedAt.getTime()) && (buildTime = publishedAt.getTime() - createdAt.getTime()), {
        ...deployItem,
        // Map Netlify API field names to our interface
        siteId: deployItem.site_id || deployItem.siteId,
        buildTime
      };
    }) : []),
    operators.catchError((error) => (console.warn(`CORS proxy ${proxyIndex + 1} failed:`, error.message), tryCorsProxy(netlifyUrl, accessToken, proxyIndex + 1)))
  );
}
function fetchDeployHistory(siteId, accessToken, proxyUrl, maxDeploys = 10) {
  const netlifyUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`;
  if (proxyUrl) {
    const url = `${proxyUrl}/sites/${siteId}/deploys`, headers = {
      "Content-Type": "application/json"
    };
    return accessToken && (headers.Authorization = `Bearer ${accessToken}`), jsonRequest(url, {
      method: "GET",
      headers
    }).pipe(
      operators.map(
        (deploys) => deploys.slice(0, maxDeploys).map((deployItem) => {
          const createdAt = deployItem.createdAt ? new Date(deployItem.createdAt) : null, publishedAt = deployItem.publishedAt ? new Date(deployItem.publishedAt) : null;
          let buildTime;
          return createdAt && publishedAt && !isNaN(createdAt.getTime()) && !isNaN(publishedAt.getTime()) && (buildTime = publishedAt.getTime() - createdAt.getTime()), {
            ...deployItem,
            // Map Netlify API field names to our interface
            siteId: deployItem.site_id || deployItem.siteId,
            buildTime
          };
        })
      )
    );
  }
  return tryCorsProxy(netlifyUrl, accessToken);
}
const initialState = {
  sites: [],
  deployHistory: {},
  isRefreshing: !1,
  action: { type: "init" }
}, stateReducer$ = operators.scan((state = initialState, action) => {
  switch (action.type) {
    case "setSites":
      return { ...state, sites: action.sites || [] };
    case "deploy/started":
      return {
        ...state,
        sites: state.sites.map((site) => action.site && site.id === action.site.id ? { ...site } : site)
      };
    case "deploy/failed":
      return {
        ...state,
        action
      };
    case "deploy/completed":
      return {
        ...state,
        sites: state.sites.map((site) => action.site && site.id === action.site.id ? { ...site, error: action.error } : site)
      };
    case "deployHistory/updated":
      return {
        ...state,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId]: action.deploys || []
        },
        isRefreshing: !1
      };
    case "deployHistory/fastUpdated":
      return {
        ...state,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId]: action.deploys || []
        },
        isRefreshing: !0
      };
    case "deployHistory/failed":
      return {
        ...state,
        isRefreshing: !1,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId]: []
          // Set empty array for failed sites
        }
      };
    default:
      return state;
  }
}), INITIAL_PROPS = {
  title: "Netlify Deployments",
  description: "Deploy your sites to Netlify",
  sites: [],
  isLoading: !0,
  onDeploy: () => {
  },
  deployHistory: {},
  isRefreshing: !1
}, createDeployHistoryStream = (site, actionType, accessToken, proxyUrl, maxDeploys = 10) => fetchDeployHistory(site.id, accessToken, proxyUrl, maxDeploys).pipe(
  operators.map((deploys) => ({ type: actionType, siteId: site.id, deploys })),
  operators.catchError((error) => (console.error(`Failed to fetch deploys for site ${site.id}:`, error), rxjs.of({ type: "deployHistory/failed", siteId: site.id, error: error.message })))
), createDeployHistoryStreams = (sites, actionType, accessToken, proxyUrl, maxDeploys = 10) => rxjs.merge(
  ...sites.map(
    (site) => createDeployHistoryStream(site, actionType, accessToken, proxyUrl, maxDeploys)
  )
), props$ = (options) => {
  const {
    accessToken,
    proxyUrl,
    maxDeploys = 10,
    pollIntervalMs = 3e4,
    fastPollIntervalMs = 5e3
  } = options, configuredSites = (options.sites || []).map((site) => ({
    id: site.apiId,
    name: site.name,
    title: site.title,
    buildHookId: site.buildHookId,
    url: site.url || site.branch && `https://${site.branch}--${site.name}.netlify.app/` || site.name && `https://${site.name}.netlify.app/`,
    adminUrl: site.name && `https://app.netlify.com/sites/${site.name}`,
    branch: site.branch
  })), [onDeploy$, onDeploy] = reactPropsStream.createEventHandler(), setSitesAction$ = rxjs.of(configuredSites).pipe(operators.map((sites) => ({ type: "setSites", sites }))), deployAction$ = onDeploy$.pipe(operators.map((site) => ({ type: "deploy/started", site }))), deployCompletedAction$ = onDeploy$.pipe(operators.switchMap((site) => deploy(site, accessToken, proxyUrl))).pipe(
    operators.map(
      (result) => ({ type: "deploy/completed", ...result }),
      operators.catchError((error) => rxjs.of({ type: "deploy/failed", error }))
    )
  ), initialLoad$ = rxjs.timer(1e3).pipe(
    operators.switchMap(
      () => rxjs.of(configuredSites).pipe(
        operators.switchMap(
          (sites) => createDeployHistoryStreams(
            sites,
            "deployHistory/updated",
            accessToken,
            proxyUrl,
            maxDeploys
          )
        )
      )
    )
  ), refreshDeployHistory$ = rxjs.timer(pollIntervalMs, pollIntervalMs).pipe(
    operators.switchMap(
      () => rxjs.of(configuredSites).pipe(
        operators.switchMap(
          (sites) => createDeployHistoryStreams(
            sites,
            "deployHistory/updated",
            accessToken,
            proxyUrl,
            maxDeploys
          )
        )
      )
    )
  ), fastRefresh$ = rxjs.timer(fastPollIntervalMs, fastPollIntervalMs).pipe(
    operators.switchMap(
      () => rxjs.of(configuredSites).pipe(
        operators.switchMap(
          (sites) => createDeployHistoryStreams(
            sites,
            "deployHistory/fastUpdated",
            accessToken,
            proxyUrl,
            maxDeploys
          )
        )
      )
    )
  );
  return rxjs.merge(
    setSitesAction$,
    deployAction$,
    deployCompletedAction$,
    initialLoad$,
    refreshDeployHistory$,
    fastRefresh$
  ).pipe(stateReducer$).pipe(
    operators.debounceTime(100),
    // Prevent rapid state changes
    operators.distinctUntilChanged(
      (prev, curr) => JSON.stringify(prev.deployHistory) === JSON.stringify(curr.deployHistory)
    ),
    operators.map((state) => ({
      sites: state.sites,
      title: options.title || INITIAL_PROPS.title,
      description: options.description,
      isLoading: !1,
      onDeploy,
      deployHistory: state.deployHistory,
      isRefreshing: state.isRefreshing
    })),
    operators.startWith(INITIAL_PROPS)
  );
}, Link = (props) => {
  const { url, children } = props;
  return /* @__PURE__ */ jsxRuntime.jsx("span", { children: /* @__PURE__ */ jsxRuntime.jsx("a", { href: url, target: "_blank", rel: "noreferrer", children }) });
}, Links = (props) => {
  const { url, adminUrl } = props;
  return url && adminUrl ? /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
    "(",
    /* @__PURE__ */ jsxRuntime.jsx(Link, { url, children: "view" }),
    ", ",
    /* @__PURE__ */ jsxRuntime.jsx(Link, { url: adminUrl, children: "admin" }),
    ")"
  ] }) : url ? /* @__PURE__ */ jsxRuntime.jsx(Link, { url, children: "(view)" }) : adminUrl ? /* @__PURE__ */ jsxRuntime.jsx(Link, { url: adminUrl, children: "(admin)" }) : null;
}, formatBuildTime = (buildTime) => {
  if (!buildTime) return "Unknown";
  const seconds = Math.floor(buildTime / 1e3), minutes = Math.floor(seconds / 60), remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}, getStatusColor = (status) => {
  switch (status) {
    case "ready":
      return "positive";
    case "error":
      return "critical";
    case "building":
      return "primary";
    case "cancelled":
      return "caution";
    default:
      return "primary";
  }
}, formatDate = (dateString) => {
  const date = new Date(dateString), diffInMinutes = Math.floor(((/* @__PURE__ */ new Date()).getTime() - date.getTime()) / (1e3 * 60));
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return diffInDays < 7 ? `${diffInDays}d ago` : date.toLocaleDateString();
}, DeployList = ({ deploys, isLoading }) => isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { padding: 3, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 1, muted: !0, children: "Loading deploy history..." }) }) : !deploys || deploys.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { padding: 3, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 1, muted: !0, children: "No deploy history available" }) }) : /* @__PURE__ */ jsxRuntime.jsx(ui.Stack, { space: 2, children: deploys.map((deploy2) => /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { padding: 3, radius: 2, tone: "default", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Stack, { space: 2, children: [
  /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { justify: "space-between", align: "center", children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Stack, { space: 1, children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 1, weight: "semibold", children: deploy2.commitMessage || `Deploy ${deploy2.id.slice(0, 8)}` }),
      deploy2.branch && /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: 0, muted: !0, children: [
        "Branch: ",
        deploy2.branch
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { tone: getStatusColor(deploy2.status), mode: "outline", children: deploy2.status })
  ] }),
  /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { justify: "space-between", align: "center", children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 0, muted: !0, children: formatDate(deploy2.createdAt) }),
    deploy2.buildTime && /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: 0, muted: !0, children: [
      "Build: ",
      formatBuildTime(deploy2.buildTime)
    ] })
  ] }),
  deploy2.errorMessage && /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { tone: "critical", padding: 2, radius: 1, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 0, children: deploy2.errorMessage }) }),
  deploy2.deployUrl && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 0, children: /* @__PURE__ */ jsxRuntime.jsx("a", { href: deploy2.deployUrl, target: "_blank", rel: "noopener noreferrer", children: "View deploy \u2192" }) })
] }) }, deploy2.id)) }), IMAGE_PULL_INTERVAL = 1e4, getImageUrl = (siteId, branchName) => {
  const baseUrl = `https://api.netlify.com/api/v1/badges/${siteId}/deploy-status`, time = (/* @__PURE__ */ new Date()).getTime(), branch = `branch=${branchName}`;
  return branchName ? `${baseUrl}?${time}&${branch}` : `${baseUrl}?${time}`;
}, useBadgeImage = (siteId, branchName) => {
  const [src, setSrc] = react.useState(() => getImageUrl(siteId, branchName)), update = react.useCallback(() => setSrc(getImageUrl(siteId, branchName)), [siteId]);
  return react.useEffect(() => {
    const interval = window.setInterval(update, IMAGE_PULL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [update]), [src, update];
}, useDeploy = (site, onDeploy, updateBadge) => {
  const timeoutRef = react.useRef(-1);
  return react.useEffect(() => () => window.clearTimeout(timeoutRef.current), []), react.useCallback(() => {
    onDeploy(site), timeoutRef.current = window.setTimeout(updateBadge, 1e3);
  }, [site, onDeploy, updateBadge]);
}, SiteItem = (props) => {
  const [hasBadgeError, setHasBadgeError] = react.useState(!1), [showDeployHistory, setShowDeployHistory] = react.useState(!1), { site, onDeploy, deployHistory = [], isRefreshing = !1 } = props, { id, name, title, url, adminUrl, buildHookId, branch } = site, [badge, updateBadge] = useBadgeImage(id, branch), handleDeploy = useDeploy(site, onDeploy, updateBadge), handleBadgeError = () => {
    setHasBadgeError(!0);
  }, toggleDeployHistory = () => {
    setShowDeployHistory(!showDeployHistory);
  }, hasDeployHistory = deployHistory && deployHistory.length > 0, latestDeploy = deployHistory[0];
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { as: "li", padding: 3, radius: 2, tone: "default", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Stack, { space: 3, children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { justify: "space-between", align: "flex-start", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { flex: 1, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Stack, { space: 2, children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { as: "h4", children: [
          title || name,
          /* @__PURE__ */ jsxRuntime.jsx(Links, { url, adminUrl })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { justify: "flex-start", align: "center", gap: 2, children: [
          !hasBadgeError && /* @__PURE__ */ jsxRuntime.jsx("img", { src: badge, onError: handleBadgeError, alt: "Badge" }),
          hasBadgeError && /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { tone: "critical", radius: 2, padding: 2, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: 0, muted: !0, children: "Failed to load badge" }) }),
          isRefreshing && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 0, muted: !0, children: "Refreshing..." })
        ] })
      ] }) }),
      buildHookId && /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { mode: "ghost", onClick: handleDeploy, text: "Deploy" }) })
    ] }),
    hasDeployHistory && /* @__PURE__ */ jsxRuntime.jsxs(ui.Box, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: 1, weight: "semibold", children: "Deploy History" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Button,
          {
            mode: "bleed",
            onClick: toggleDeployHistory,
            text: showDeployHistory ? "Hide" : "Show",
            size: 0
          }
        )
      ] }),
      latestDeploy && /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { marginTop: 2, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: 0, muted: !0, children: [
        "Latest: ",
        latestDeploy.status,
        " \u2022",
        " ",
        new Date(latestDeploy.createdAt).toLocaleDateString()
      ] }) }),
      showDeployHistory && /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { marginTop: 3, children: /* @__PURE__ */ jsxRuntime.jsx(DeployList, { deploys: deployHistory, isLoading: isRefreshing }) })
    ] })
  ] }) });
};
function SiteList(props) {
  const { isLoading, onDeploy, sites, deployHistory = {}, isRefreshing = !1 } = props;
  return isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { padding: 4, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Flex, { direction: "column", justify: "center", align: "center", children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Spinner, { muted: !0 }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { marginTop: 3, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { muted: !0, children: "Loading sites\u2026" }) })
  ] }) }) : !sites || sites && sites.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Card, { tone: "critical", padding: 3, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { children: "No sites are defined in the widget options. Please check your config." }) }) : /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { paddingY: 2, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Stack, { as: "ul", space: 2, children: sites.map((site, index) => /* @__PURE__ */ jsxRuntime.jsx(
    SiteItem,
    {
      onDeploy,
      site,
      deployHistory: deployHistory[site.id] || [],
      isRefreshing
    },
    `site-${index}`
  )) }) });
}
const ContentCard = styledComponents.styled(ui.Card)`
  min-height: 66px;
`;
function NetlifyWidget(props) {
  const netlifySitesUrl = "https://app.netlify.com/account/sites", {
    title,
    description,
    isLoading,
    sites,
    onDeploy,
    deployHistory = {},
    isRefreshing = !1
  } = props;
  return /* @__PURE__ */ jsxRuntime.jsx(dashboard.DashboardWidgetContainer, { header: title, footer: /* @__PURE__ */ jsxRuntime.jsx(ui.Flex, { direction: "column", align: "stretch", children: /* @__PURE__ */ jsxRuntime.jsx(
    ui.Button,
    {
      as: "a",
      href: isLoading ? void 0 : netlifySitesUrl,
      disabled: isLoading,
      paddingX: 2,
      paddingY: 4,
      mode: "bleed",
      tone: "primary",
      text: "Manage sites at Netlify",
      loading: isLoading,
      target: "_blank"
    }
  ) }), children: /* @__PURE__ */ jsxRuntime.jsxs(ContentCard, { paddingY: 1, children: [
    description && /* @__PURE__ */ jsxRuntime.jsx(ui.Box, { paddingY: 3, paddingX: 3, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { as: "p", size: 1, muted: !0, children: /* @__PURE__ */ jsxRuntime.jsx("span", { dangerouslySetInnerHTML: { __html: description } }) }) }),
    /* @__PURE__ */ jsxRuntime.jsx(
      SiteList,
      {
        isLoading,
        onDeploy,
        sites,
        deployHistory,
        isRefreshing
      }
    )
  ] }) });
}
var Widget = reactPropsStream.streamingComponent(
  (options$) => options$.pipe(
    operators.switchMap(
      (options) => props$(options).pipe(
        operators.map((props) => /* @__PURE__ */ jsxRuntime.jsx(NetlifyWidget, { ...props }))
      )
    )
  )
);
function netlifyWidget(config) {
  return {
    name: "netlify-widget",
    component: () => /* @__PURE__ */ jsxRuntime.jsx(Widget, { ...config }),
    layout: config.layout ?? { width: "medium" }
  };
}
exports.netlifyWidget = netlifyWidget;
//# sourceMappingURL=index.js.map
