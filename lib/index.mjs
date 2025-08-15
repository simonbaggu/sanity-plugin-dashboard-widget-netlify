import { jsxs, jsx } from "react/jsx-runtime";
import { createEventHandler, streamingComponent } from "react-props-stream";
import { map, scan, switchMap, catchError, startWith } from "rxjs/operators";
import { Observable, of, timer, merge } from "rxjs";
import AbortControllerPolyfill from "abort-controller";
import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, Stack, Card, Flex, Badge, Label, Button, Spinner } from "@sanity/ui";
import { DashboardWidgetContainer } from "@sanity/dashboard";
import { styled } from "styled-components";
const createAbortController = () => "AbortController" in window ? new AbortController() : new AbortControllerPolyfill(), statusCodeRequest = (input, init) => new Observable((subscriber) => {
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
}), jsonRequest = (input, init) => new Observable((subscriber) => {
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
});
function deploy(site, accessToken, proxyUrl) {
  if (!site.buildHookId)
    return of(new Error("Site missing buildHookId"));
  const url = proxyUrl ? `${proxyUrl}/build_hooks/${site.buildHookId}` : `https://api.netlify.com/build_hooks/${site.buildHookId}`, headers = {};
  return accessToken && (headers.Authorization = `Bearer ${accessToken}`), statusCodeRequest(url, {
    method: "POST",
    headers
  }).pipe(map((result) => ({ result, site })));
}
function fetchDeployHistory(siteId, accessToken, proxyUrl, maxDeploys = 10) {
  const url = `${proxyUrl || "/api/netlify"}/sites/${siteId}/deploys`, headers = {
    "Content-Type": "application/json"
  };
  return accessToken && (headers.Authorization = `Bearer ${accessToken}`), jsonRequest(url, {
    method: "GET",
    headers
  }).pipe(
    map(
      (deploys) => deploys.slice(0, maxDeploys).map((deployItem) => ({
        ...deployItem,
        buildTime: deployItem.publishedAt && deployItem.createdAt ? new Date(deployItem.publishedAt).getTime() - new Date(deployItem.createdAt).getTime() : void 0
      }))
    )
  );
}
const initialState = {
  sites: [],
  deployHistory: {},
  isRefreshing: !1,
  action: { type: "init" }
}, stateReducer$ = scan((state = initialState, action) => {
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
}), noop = () => {
}, INITIAL_PROPS = {
  title: "Netlify sites",
  sites: [],
  isLoading: !0,
  onDeploy: noop,
  deployHistory: {},
  isRefreshing: !1
}, createDeployHistoryStream = (site, actionType, accessToken, proxyUrl, maxDeploys = 10) => fetchDeployHistory(site.id, accessToken, proxyUrl, maxDeploys).pipe(
  map((deploys) => ({ type: actionType, siteId: site.id, deploys })),
  catchError((error) => (console.error(`Failed to fetch deploys for site ${site.id}:`, error), of({ type: "deployHistory/failed", siteId: site.id, error: error.message })))
), createDeployHistoryStreams = (sites, actionType, accessToken, proxyUrl, maxDeploys = 10) => merge(
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
  })), [onDeploy$, onDeploy] = createEventHandler(), setSitesAction$ = of(configuredSites).pipe(map((sites) => ({ type: "setSites", sites }))), deployAction$ = onDeploy$.pipe(map((site) => ({ type: "deploy/started", site }))), deployCompletedAction$ = onDeploy$.pipe(switchMap((site) => deploy(site, accessToken, proxyUrl))).pipe(
    map(
      (result) => ({ type: "deploy/completed", ...result }),
      catchError((error) => of({ type: "deploy/failed", error }))
    )
  ), refreshDeployHistory$ = timer(0, pollIntervalMs).pipe(
    switchMap(
      () => of(configuredSites).pipe(
        switchMap(
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
  ), fastRefresh$ = timer(0, fastPollIntervalMs).pipe(
    switchMap(
      () => of(configuredSites).pipe(
        switchMap(
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
  return merge(
    setSitesAction$,
    deployAction$,
    deployCompletedAction$,
    refreshDeployHistory$,
    fastRefresh$
  ).pipe(stateReducer$).pipe(
    map((state) => ({
      sites: state.sites,
      title: options.title || INITIAL_PROPS.title,
      description: options.description,
      isLoading: !1,
      onDeploy,
      deployHistory: state.deployHistory,
      isRefreshing: state.isRefreshing
    })),
    startWith(INITIAL_PROPS)
  );
}, Link = (props) => {
  const { url, children } = props;
  return /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx("a", { href: url, target: "_blank", rel: "noreferrer", children }) });
}, Links = (props) => {
  const { url, adminUrl } = props;
  return url && adminUrl ? /* @__PURE__ */ jsxs("span", { children: [
    "(",
    /* @__PURE__ */ jsx(Link, { url, children: "view" }),
    ", ",
    /* @__PURE__ */ jsx(Link, { url: adminUrl, children: "admin" }),
    ")"
  ] }) : url ? /* @__PURE__ */ jsx(Link, { url, children: "(view)" }) : adminUrl ? /* @__PURE__ */ jsx(Link, { url: adminUrl, children: "(admin)" }) : null;
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
}, DeployList = ({ deploys, isLoading }) => isLoading ? /* @__PURE__ */ jsx(Box, { padding: 3, children: /* @__PURE__ */ jsx(Text, { size: 1, muted: !0, children: "Loading deploy history..." }) }) : !deploys || deploys.length === 0 ? /* @__PURE__ */ jsx(Box, { padding: 3, children: /* @__PURE__ */ jsx(Text, { size: 1, muted: !0, children: "No deploy history available" }) }) : /* @__PURE__ */ jsx(Stack, { space: 2, children: deploys.map((deploy2) => /* @__PURE__ */ jsx(Card, { padding: 3, radius: 2, tone: "default", children: /* @__PURE__ */ jsxs(Stack, { space: 2, children: [
  /* @__PURE__ */ jsxs(Flex, { justify: "space-between", align: "center", children: [
    /* @__PURE__ */ jsxs(Stack, { space: 1, children: [
      /* @__PURE__ */ jsx(Text, { size: 1, weight: "semibold", children: deploy2.commitMessage || `Deploy ${deploy2.id.slice(0, 8)}` }),
      deploy2.branch && /* @__PURE__ */ jsxs(Text, { size: 0, muted: !0, children: [
        "Branch: ",
        deploy2.branch
      ] })
    ] }),
    /* @__PURE__ */ jsx(Badge, { tone: getStatusColor(deploy2.status), mode: "outline", children: deploy2.status })
  ] }),
  /* @__PURE__ */ jsxs(Flex, { justify: "space-between", align: "center", children: [
    /* @__PURE__ */ jsx(Text, { size: 0, muted: !0, children: formatDate(deploy2.createdAt) }),
    deploy2.buildTime && /* @__PURE__ */ jsxs(Text, { size: 0, muted: !0, children: [
      "Build: ",
      formatBuildTime(deploy2.buildTime)
    ] })
  ] }),
  deploy2.errorMessage && /* @__PURE__ */ jsx(Card, { tone: "critical", padding: 2, radius: 1, children: /* @__PURE__ */ jsx(Text, { size: 0, children: deploy2.errorMessage }) }),
  deploy2.deployUrl && /* @__PURE__ */ jsx(Text, { size: 0, children: /* @__PURE__ */ jsx("a", { href: deploy2.deployUrl, target: "_blank", rel: "noopener noreferrer", children: "View deploy \u2192" }) })
] }) }, deploy2.id)) }), IMAGE_PULL_INTERVAL = 1e4, getImageUrl = (siteId, branchName) => {
  const baseUrl = `https://api.netlify.com/api/v1/badges/${siteId}/deploy-status`, time = (/* @__PURE__ */ new Date()).getTime(), branch = `branch=${branchName}`;
  return branchName ? `${baseUrl}?${time}&${branch}` : `${baseUrl}?${time}`;
}, useBadgeImage = (siteId, branchName) => {
  const [src, setSrc] = useState(() => getImageUrl(siteId, branchName)), update = useCallback(() => setSrc(getImageUrl(siteId, branchName)), [siteId]);
  return useEffect(() => {
    const interval = window.setInterval(update, IMAGE_PULL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [update]), [src, update];
}, useDeploy = (site, onDeploy, updateBadge) => {
  const timeoutRef = useRef(-1);
  return useEffect(() => () => window.clearTimeout(timeoutRef.current), []), useCallback(() => {
    onDeploy(site), timeoutRef.current = window.setTimeout(updateBadge, 1e3);
  }, [site, onDeploy, updateBadge]);
}, SiteItem = (props) => {
  const [hasBadgeError, setHasBadgeError] = useState(!1), [showDeployHistory, setShowDeployHistory] = useState(!1), { site, onDeploy, deployHistory = [], isRefreshing = !1 } = props, { id, name, title, url, adminUrl, buildHookId, branch } = site, [badge, updateBadge] = useBadgeImage(id, branch), handleDeploy = useDeploy(site, onDeploy, updateBadge), handleBadgeError = () => {
    setHasBadgeError(!0);
  }, toggleDeployHistory = () => {
    setShowDeployHistory(!showDeployHistory);
  }, hasDeployHistory = deployHistory && deployHistory.length > 0, latestDeploy = deployHistory[0];
  return /* @__PURE__ */ jsx(Card, { as: "li", padding: 3, radius: 2, tone: "default", children: /* @__PURE__ */ jsxs(Stack, { space: 3, children: [
    /* @__PURE__ */ jsxs(Flex, { justify: "space-between", align: "flex-start", children: [
      /* @__PURE__ */ jsx(Box, { flex: 1, children: /* @__PURE__ */ jsxs(Stack, { space: 2, children: [
        /* @__PURE__ */ jsxs(Text, { as: "h4", children: [
          title || name,
          /* @__PURE__ */ jsx(Links, { url, adminUrl })
        ] }),
        /* @__PURE__ */ jsxs(Flex, { justify: "flex-start", align: "center", gap: 2, children: [
          !hasBadgeError && /* @__PURE__ */ jsx("img", { src: badge, onError: handleBadgeError, alt: "Badge" }),
          hasBadgeError && /* @__PURE__ */ jsx(Card, { tone: "critical", radius: 2, padding: 2, children: /* @__PURE__ */ jsx(Label, { size: 0, muted: !0, children: "Failed to load badge" }) }),
          isRefreshing && /* @__PURE__ */ jsx(Text, { size: 0, muted: !0, children: "Refreshing..." })
        ] })
      ] }) }),
      buildHookId && /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsx(Button, { mode: "ghost", onClick: handleDeploy, text: "Deploy" }) })
    ] }),
    hasDeployHistory && /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsxs(Flex, { justify: "space-between", align: "center", children: [
        /* @__PURE__ */ jsx(Text, { size: 1, weight: "semibold", children: "Deploy History" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            mode: "bleed",
            onClick: toggleDeployHistory,
            text: showDeployHistory ? "Hide" : "Show",
            size: 0
          }
        )
      ] }),
      latestDeploy && /* @__PURE__ */ jsx(Box, { marginTop: 2, children: /* @__PURE__ */ jsxs(Text, { size: 0, muted: !0, children: [
        "Latest: ",
        latestDeploy.status,
        " \u2022",
        " ",
        new Date(latestDeploy.createdAt).toLocaleDateString()
      ] }) }),
      showDeployHistory && /* @__PURE__ */ jsx(Box, { marginTop: 3, children: /* @__PURE__ */ jsx(DeployList, { deploys: deployHistory, isLoading: isRefreshing }) })
    ] })
  ] }) });
};
function SiteList(props) {
  const { isLoading, onDeploy, sites, deployHistory = {}, isRefreshing = !1 } = props;
  return isLoading ? /* @__PURE__ */ jsx(Card, { padding: 4, children: /* @__PURE__ */ jsxs(Flex, { direction: "column", justify: "center", align: "center", children: [
    /* @__PURE__ */ jsx(Spinner, { muted: !0 }),
    /* @__PURE__ */ jsx(Box, { marginTop: 3, children: /* @__PURE__ */ jsx(Text, { muted: !0, children: "Loading sites\u2026" }) })
  ] }) }) : !sites || sites && sites.length === 0 ? /* @__PURE__ */ jsx(Card, { tone: "critical", padding: 3, children: /* @__PURE__ */ jsx(Text, { children: "No sites are defined in the widget options. Please check your config." }) }) : /* @__PURE__ */ jsx(Box, { paddingY: 2, children: /* @__PURE__ */ jsx(Stack, { as: "ul", space: 2, children: sites.map((site, index) => /* @__PURE__ */ jsx(
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
const ContentCard = styled(Card)`
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
  return /* @__PURE__ */ jsx(DashboardWidgetContainer, { header: title, footer: /* @__PURE__ */ jsx(Flex, { direction: "column", align: "stretch", children: /* @__PURE__ */ jsx(
    Button,
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
  ) }), children: /* @__PURE__ */ jsxs(ContentCard, { paddingY: 1, children: [
    description && /* @__PURE__ */ jsx(Box, { paddingY: 3, paddingX: 3, children: /* @__PURE__ */ jsx(Text, { as: "p", size: 1, muted: !0, children: /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: description } }) }) }),
    /* @__PURE__ */ jsx(
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
var Widget = streamingComponent(
  (options$) => options$.pipe(
    switchMap(
      (options) => props$(options).pipe(
        map((props) => /* @__PURE__ */ jsx(NetlifyWidget, { ...props }))
      )
    )
  )
);
function netlifyWidget(config) {
  return {
    name: "netlify-widget",
    component: () => /* @__PURE__ */ jsx(Widget, { ...config }),
    layout: config.layout ?? { width: "medium" }
  };
}
export {
  netlifyWidget
};
//# sourceMappingURL=index.mjs.map
