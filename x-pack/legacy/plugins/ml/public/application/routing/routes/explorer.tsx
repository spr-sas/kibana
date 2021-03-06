/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import moment from 'moment';
import React, { FC, useEffect, useState } from 'react';
import useObservable from 'react-use/lib/useObservable';

import { i18n } from '@kbn/i18n';

import { timefilter } from 'ui/timefilter';

import { MlJobWithTimeRange } from '../../../../common/types/jobs';

import { MlRoute, PageLoader, PageProps } from '../router';
import { useRefresh } from '../use_refresh';
import { useResolver } from '../use_resolver';
import { basicResolvers } from '../resolvers';
import { Explorer } from '../../explorer';
import { useSelectedCells } from '../../explorer/hooks/use_selected_cells';
import { mlJobService } from '../../services/job_service';
import { ml } from '../../services/ml_api_service';
import { useExplorerData } from '../../explorer/actions';
import { explorerService } from '../../explorer/explorer_dashboard_service';
import { getDateFormatTz } from '../../explorer/explorer_utils';
import { useSwimlaneLimit } from '../../explorer/select_limit';
import { useJobSelection } from '../../components/job_selector/use_job_selection';
import { useShowCharts } from '../../components/controls/checkbox_showcharts';
import { useTableInterval } from '../../components/controls/select_interval';
import { useTableSeverity } from '../../components/controls/select_severity';
import { useUrlState } from '../../util/url_state';
import { ANOMALY_DETECTION_BREADCRUMB, ML_BREADCRUMB } from '../breadcrumbs';

const breadcrumbs = [
  ML_BREADCRUMB,
  ANOMALY_DETECTION_BREADCRUMB,
  {
    text: i18n.translate('xpack.ml.anomalyDetection.anomalyExplorerLabel', {
      defaultMessage: 'Anomaly Explorer',
    }),
    href: '',
  },
];

export const explorerRoute: MlRoute = {
  path: '/explorer',
  render: (props, config, deps) => <PageWrapper config={config} {...props} deps={deps} />,
  breadcrumbs,
};

const PageWrapper: FC<PageProps> = ({ config, deps }) => {
  const { context, results } = useResolver(undefined, undefined, config, {
    ...basicResolvers(deps),
    jobs: mlJobService.loadJobsWrapper,
    jobsWithTimeRange: () => ml.jobs.jobsWithTimerange(getDateFormatTz()),
  });

  return (
    <PageLoader context={context}>
      <ExplorerUrlStateManager jobsWithTimeRange={results.jobsWithTimeRange.jobs} />
    </PageLoader>
  );
};

interface ExplorerUrlStateManagerProps {
  jobsWithTimeRange: MlJobWithTimeRange[];
}

const ExplorerUrlStateManager: FC<ExplorerUrlStateManagerProps> = ({ jobsWithTimeRange }) => {
  const [appState, setAppState] = useUrlState('_a');
  const [globalState] = useUrlState('_g');
  const [lastRefresh, setLastRefresh] = useState(0);

  const { jobIds } = useJobSelection(jobsWithTimeRange, getDateFormatTz());

  const refresh = useRefresh();
  useEffect(() => {
    if (refresh !== undefined) {
      setLastRefresh(refresh?.lastRefresh);
      const activeBounds = timefilter.getActiveBounds();
      if (activeBounds !== undefined) {
        explorerService.setBounds(activeBounds);
      }
    }
  }, [refresh?.lastRefresh]);

  useEffect(() => {
    timefilter.enableTimeRangeSelector();
    timefilter.enableAutoRefreshSelector();

    const viewByFieldName = appState?.mlExplorerSwimlane?.viewByFieldName;
    if (viewByFieldName !== undefined) {
      explorerService.setViewBySwimlaneFieldName(viewByFieldName);
    }

    const filterData = appState?.mlExplorerFilter;
    if (filterData !== undefined) {
      explorerService.setFilterData(filterData);
    }
  }, []);

  useEffect(() => {
    if (globalState?.time !== undefined) {
      timefilter.setTime({
        from: globalState.time.from,
        to: globalState.time.to,
      });
      explorerService.setBounds({
        min: moment(globalState.time.from),
        max: moment(globalState.time.to),
      });
    }
  }, [globalState?.time?.from, globalState?.time?.to]);

  useEffect(() => {
    if (jobIds.length > 0) {
      explorerService.updateJobSelection(jobIds);
    } else {
      explorerService.clearJobs();
    }
  }, [JSON.stringify(jobIds)]);

  const [explorerData, loadExplorerData] = useExplorerData();
  useEffect(() => {
    if (explorerData !== undefined && Object.keys(explorerData).length > 0) {
      explorerService.setExplorerData(explorerData);
    }
  }, [explorerData]);

  const explorerAppState = useObservable(explorerService.appState$);
  useEffect(() => {
    if (
      explorerAppState !== undefined &&
      explorerAppState.mlExplorerSwimlane.viewByFieldName !== undefined
    ) {
      setAppState(explorerAppState);
    }
  }, [explorerAppState]);

  const explorerState = useObservable(explorerService.state$);

  const [showCharts] = useShowCharts();
  const [tableInterval] = useTableInterval();
  const [tableSeverity] = useTableSeverity();
  const [swimlaneLimit] = useSwimlaneLimit();
  useEffect(() => {
    explorerService.setSwimlaneLimit(swimlaneLimit);
  }, [swimlaneLimit]);

  const [selectedCells, setSelectedCells] = useSelectedCells();
  useEffect(() => {
    explorerService.setSelectedCells(selectedCells);
  }, [JSON.stringify(selectedCells)]);

  const loadExplorerDataConfig =
    (explorerState !== undefined && {
      bounds: explorerState.bounds,
      lastRefresh,
      influencersFilterQuery: explorerState.influencersFilterQuery,
      noInfluencersConfigured: explorerState.noInfluencersConfigured,
      selectedCells,
      selectedJobs: explorerState.selectedJobs,
      swimlaneBucketInterval: explorerState.swimlaneBucketInterval,
      swimlaneLimit: explorerState.swimlaneLimit,
      tableInterval: tableInterval.val,
      tableSeverity: tableSeverity.val,
      viewBySwimlaneFieldName: explorerState.viewBySwimlaneFieldName,
    }) ||
    undefined;
  useEffect(() => {
    loadExplorerData(loadExplorerDataConfig);
  }, [JSON.stringify(loadExplorerDataConfig)]);

  if (explorerState === undefined || refresh === undefined || showCharts === undefined) {
    return null;
  }

  return (
    <div className="ml-explorer">
      <Explorer
        {...{
          explorerState,
          setSelectedCells,
          showCharts,
          severity: tableSeverity.val,
        }}
      />
    </div>
  );
};
