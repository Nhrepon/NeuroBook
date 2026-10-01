// §3.2.1 — background fetch, every 15 min when backgrounded.
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { processSyncQueue } from './queue'

const BACKGROUND_SYNC_TASK = 'neurobook-sync'

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const { ok } = await processSyncQueue()
  return ok > 0
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.NoData
})

export async function registerBackgroundSync() {
  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  })
}
