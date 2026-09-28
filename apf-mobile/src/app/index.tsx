import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { login } from "../services/api";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(
        "Data belum lengkap",
        "Silakan masukkan username dan password."
      );
      return;
    }

    try {
      setLoading(true);

      const user = await login(username.trim(), password);

      Alert.alert(
        "Login Berhasil",
        `Selamat datang, ${user.name || user.username}.`,
        [
          {
            text: "Lanjut",
            onPress: () => router.replace("/dashboard"),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Login Gagal",
        error instanceof Error
          ? error.message
          : "Tidak dapat terhubung ke server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#071426" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.backgroundCircleOne} />
        <View style={styles.backgroundCircleTwo} />

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoOuter}>
              <Text style={styles.logoText}>APF</Text>
            </View>

            <Text style={styles.title}>APF MONITORING CENTER</Text>

            <Text style={styles.subtitle}>Bea Cukai Soekarno-Hatta</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.welcome}>Selamat Datang</Text>

            <Text style={styles.description}>
              Silakan masuk untuk mengakses monitoring rekomendasi pemeriksaan.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>USERNAME</Text>

              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Masukkan username"
                placeholderTextColor="#8A94A6"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Masukkan password"
                  placeholderTextColor="#8A94A6"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                />

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.showButton}
                >
                  <Text style={styles.showText}>
                    {showPassword ? "SEMBUNYIKAN" : "LIHAT"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                loading && styles.loginButtonDisabled,
              ]}
            >
              <Text style={styles.loginButtonText}>
                {loading ? "MEMPROSES..." : "MASUK"}
              </Text>
            </Pressable>

            <Text style={styles.footerText}>Sistem Monitoring APF</Text>
          </View>
        </View>

        <Text style={styles.bottomText}>© 2026 Bea Cukai Soekarno-Hatta</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#071426",
  },

  container: {
    flex: 1,
    backgroundColor: "#071426",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  backgroundCircleOne: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#0B1F3A",
    top: -100,
    right: -100,
  },

  backgroundCircleTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#0B1F3A",
    bottom: -80,
    left: -90,
  },

  content: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 28,
  },

  logoOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: "#D4A72C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  logoText: {
    color: "#D4A72C",
    fontSize: 25,
    fontWeight: "900",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  subtitle: {
    color: "#AEB8C7",
    fontSize: 13,
    marginTop: 7,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },

  welcome: {
    color: "#071426",
    fontSize: 25,
    fontWeight: "800",
  },

  description: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 25,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D9DEE7",
    borderRadius: 12,
    paddingHorizontal: 15,
    color: "#071426",
    backgroundColor: "#F8FAFC",
    fontSize: 14,
  },

  passwordContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D9DEE7",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    color: "#071426",
    fontSize: 14,
  },

  showButton: {
    paddingHorizontal: 12,
  },

  showText: {
    color: "#D4A72C",
    fontSize: 10,
    fontWeight: "800",
  },

  loginButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: "#D4A72C",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  loginButtonPressed: {
    opacity: 0.8,
  },

  loginButtonDisabled: {
    opacity: 0.5,
  },

  loginButtonText: {
    color: "#071426",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },

  footerText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 18,
  },

  bottomText: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    color: "#64748B",
    fontSize: 10,
  },
});
