// U4: three explicit UI states (loading, empty, error). Actionable retry.
import { Component, type ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => this.setState({ error: null })

  override render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-lg font-semibold">Something went wrong</Text>
          <Text className="mt-2 text-sm text-gray-600">{this.state.error.message}</Text>
          <Pressable onPress={this.reset} className="mt-4 rounded border px-4 py-2">
            <Text>Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
