export type ResearchRoute =
  | {
      page: "library";
      buildId?: undefined;
      setupSnapshotId?: undefined;
      returnTo?: ResearchRoute;
    }
  | {
      page: "build";
      buildId: string;
      setupSnapshotId?: undefined;
      returnTo?: ResearchRoute;
    }
  | {
      page: "setup";
      buildId: string;
      setupSnapshotId: string;
      returnTo?: ResearchRoute;
    }
  | {
      page: "optimizer";
      buildId: string;
      setupSnapshotId: string;
      returnTo?: ResearchRoute;
    }
  | {
      page: "optimizerRun";
      buildId: string;
      optimizerRunId: string;
      setupSnapshotId?: undefined;
      returnTo?: ResearchRoute;
    }
  | {
      page: "savedCombos";
      buildId: string;
      setupSnapshotId?: undefined;
      returnTo?: ResearchRoute;
    }
  | {
      page: "builder";
      buildId?: string;
      setupSnapshotId?: string;
      returnTo?: ResearchRoute;
    }
  | {
      page: "continuous-optimizer";
      buildId?: undefined;
      setupSnapshotId?: undefined;
      returnTo?: ResearchRoute;
    };

export function createResearchRoute(): ResearchRoute {
  return { page: "library" };
}

export function openBuild(_route: ResearchRoute, buildId: string): ResearchRoute {
  return {
    page: "build",
    buildId,
  };
}

export function openSetup(_route: ResearchRoute, buildId: string, setupSnapshotId: string): ResearchRoute {
  return {
    page: "setup",
    buildId,
    setupSnapshotId,
    returnTo: {
      page: "build",
      buildId,
    },
  };
}

export function openOptimizerFromSetup(_route: ResearchRoute, buildId: string, setupSnapshotId: string): ResearchRoute {
  return {
    page: "optimizer",
    buildId,
    setupSnapshotId,
    returnTo: {
      page: "setup",
      buildId,
      setupSnapshotId,
    },
  };
}

export function openOptimizerRun(_route: ResearchRoute, buildId: string, optimizerRunId: string): ResearchRoute {
  return {
    page: "optimizerRun",
    buildId,
    optimizerRunId,
    returnTo: {
      page: "build",
      buildId,
    },
  };
}

export function openSavedComboComparison(_route: ResearchRoute, buildId: string): ResearchRoute {
  return {
    page: "savedCombos",
    buildId,
    returnTo: {
      page: "build",
      buildId,
    },
  };
}

export function openContinuousOptimizer(route: ResearchRoute): ResearchRoute {
  return {
    page: "continuous-optimizer",
    returnTo: route,
  };
}

export function openBuilderFromSetup(_route: ResearchRoute, buildId: string, setupSnapshotId: string): ResearchRoute {
  return {
    page: "builder",
    buildId,
    setupSnapshotId,
    returnTo: _route.page === "builder" ? {
      page: "build",
      buildId,
    } : _route,
  };
}

export function returnToBuild(route: ResearchRoute): ResearchRoute {
  if (route.buildId) {
    return {
      page: "build",
      buildId: route.buildId,
    };
  }

  return { page: "library" };
}

export function returnToPrevious(route: ResearchRoute): ResearchRoute {
  return route.returnTo ?? returnToBuild(route);
}

export function retargetSetupRoute(route: ResearchRoute, setupSnapshotId: string): ResearchRoute {
  const returnTo = route.returnTo ? retargetSetupRoute(route.returnTo, setupSnapshotId) : undefined;

  switch (route.page) {
    case "setup":
    case "optimizer":
    case "builder":
      if (!route.setupSnapshotId) {
        return returnTo ? { ...route, returnTo } : route;
      }
      return returnTo ? { ...route, setupSnapshotId, returnTo } : { ...route, setupSnapshotId };
    case "library":
    case "build":
    case "optimizerRun":
    case "savedCombos":
    case "continuous-optimizer":
      return returnTo ? { ...route, returnTo } : route;
  }
}
