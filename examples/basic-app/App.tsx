import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title} testID="title">
        RN Playwright Driver Example
      </Text>

      <Text style={styles.counter} testID="count-display">
        Count: {count}
      </Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.button}
          onPress={() => setCount((c) => c - 1)}
          testID="decrement-button"
          accessibilityRole="button"
          accessibilityLabel="Decrement"
        >
          <Text style={styles.buttonText}>-</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => setCount((c) => c + 1)}
          testID="increment-button"
          accessibilityRole="button"
          accessibilityLabel="Increment"
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.button, styles.resetButton]}
        onPress={() => setCount(0)}
        testID="reset-button"
        accessibilityRole="button"
        accessibilityLabel="Reset"
      >
        <Text style={styles.buttonText}>Reset</Text>
      </Pressable>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 40,
  },
  counter: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: 40,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    minWidth: 60,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "#666",
  },
  buttonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
});
