import { hostedPreview } from '@/utilities/previewConfig';
import { useSeasonData } from './useSeasonData';

export function useCurrentSeasonData() {
  const data = useSeasonData({
    enabled: () => hostedPreview || Boolean(process.env.VUE_APP_API_BASE),
  });
  return { ...data, fetchCurrentSeasonData: data.fetchSeasonData };
}
