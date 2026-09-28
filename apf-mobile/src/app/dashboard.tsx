import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  getDashboardSummary,
  getRecommendations,
  type DashboardData,
  type Recommendation,
} from "../services/api";

type MenuType = "dashboard" | "rekomendasi" | "laporan";

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuType>("dashboard");

  const loadDashboard = async () => {
    try {
      setError("");

      const [dashboardResult, recommendationResult] = await Promise.all([
        getDashboardSummary(),
        getRecommendations(),
      ]);

      setData(dashboardResult);
      setRecommendations(recommendationResult);
    } catch (error) {
      console.error("Dashboard error:", error);
      setError("Tidak dapat terhubung ke server APF.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const openMenu = (menu: MenuType) => {
    setActiveMenu(menu);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Apakah kamu yakin ingin keluar dari aplikasi?", [
      {
        text: "Batal",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          router.replace("/");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4A72C" />

        <Text style={styles.loadingText}>Memuat Dashboard APF...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>

        <Text style={styles.errorTitle}>Koneksi Gagal</Text>

        <Text style={styles.errorText}>
          {error || "Data dashboard tidak tersedia."}
        </Text>

        <Pressable style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryButtonText}>Coba Lagi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* =====================================================
          BACKGROUND IMAGE
      ====================================================== */}

      <ImageBackground
        source={require("../../assets/bcsoetta.jpg")}
        resizeMode="cover"
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        {/* OVERLAY AGAR FOTO SAMAR */}

        <View style={styles.backgroundOverlay} />

        {/* =====================================================
            OVERLAY SIDEBAR
        ====================================================== */}

        {menuOpen && (
          <Pressable
            style={styles.overlay}
            onPress={() => setMenuOpen(false)}
          />
        )}

        {/* =====================================================
            SIDEBAR
        ====================================================== */}

        <View
          style={[
            styles.sidebar,
            menuOpen ? styles.sidebarOpen : styles.sidebarClosed,
          ]}
        >
          <View style={styles.sidebarHeader}>
            <View>
              <Text style={styles.sidebarBrand}>APF</Text>

              <Text style={styles.sidebarTitle}>MONITORING CENTER</Text>
            </View>

            <Pressable
              onPress={() => setMenuOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.sidebarDivider} />

          <Text style={styles.menuLabel}>MENU UTAMA</Text>

          <MenuItem
            icon="⌂"
            title="Dashboard"
            active={activeMenu === "dashboard"}
            onPress={() => openMenu("dashboard")}
          />

          <MenuItem
            icon="▣"
            title="Rekomendasi"
            active={activeMenu === "rekomendasi"}
            onPress={() => openMenu("rekomendasi")}
          />

          <MenuItem
            icon="▤"
            title="Laporan"
            active={activeMenu === "laporan"}
            onPress={() => openMenu("laporan")}
          />

          <View style={styles.sidebarBottom}>
            <View style={styles.sidebarInfo}>
              <View style={styles.sidebarOnlineDot} />

              <View>
                <Text style={styles.sidebarOnlineTitle}>System Online</Text>

                <Text style={styles.sidebarOnlineText}>
                  APF Bea Cukai Soekarno-Hatta
                </Text>
              </View>
            </View>

            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutIcon}>↪</Text>

              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <View style={styles.mainContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {/* =================================================
                HEADER
            ================================================== */}

            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Pressable
                  style={styles.menuButton}
                  onPress={() => setMenuOpen(true)}
                >
                  <Text style={styles.menuButtonText}>☰</Text>
                </Pressable>

                <View style={styles.headerTitleContainer}>
                  <Text style={styles.brand}>APF MONITORING CENTER</Text>

                  <Text style={styles.headerTitle}>
                    {activeMenu === "dashboard"
                      ? "Dashboard"
                      : activeMenu === "rekomendasi"
                      ? "Rekomendasi"
                      : "Laporan"}
                  </Text>

                  <Text style={styles.headerSubtitle}>
                    Bea Cukai Soekarno-Hatta
                  </Text>
                </View>

                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />

                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>
            </View>

            {/* =================================================
                DASHBOARD
            ================================================== */}

            {activeMenu === "dashboard" && (
              <DashboardContent data={data} recommendations={recommendations} />
            )}

            {/* =================================================
                REKOMENDASI
            ================================================== */}

            {activeMenu === "rekomendasi" && (
              <RecommendationContent recommendations={recommendations} />
            )}

            {/* =================================================
                LAPORAN
            ================================================== */}

            {activeMenu === "laporan" && (
              <ReportContent data={data} recommendations={recommendations} />
            )}
          </ScrollView>
        </View>
      </ImageBackground>
    </View>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function DashboardContent({
  data,
  recommendations,
}: {
  data: DashboardData;
  recommendations: Recommendation[];
}) {
  return (
    <>
      {/* HERO */}

      <View style={styles.heroCard}>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>CAPAIAN APF</Text>

          <Text style={styles.heroValue}>{data.capaian}%</Text>

          <Text style={styles.heroDescription}>
            Persentase capaian tindak lanjut rekomendasi pemeriksaan
          </Text>
        </View>

        <View style={styles.heroCircle}>
          <Text style={styles.heroCircleValue}>{data.capaian}%</Text>

          <Text style={styles.heroCircleLabel}>CAPAIAN</Text>
        </View>
      </View>

      {/* EXECUTIVE SUMMARY */}

      <Text style={styles.sectionTitle}>Executive Summary</Text>

      <View style={styles.kpiGrid}>
        <KpiCard title="Total Rekomendasi" value={data.total} icon="▣" />

        <KpiCard title="Belum Tindak Lanjut" value={data.belumTl} icon="!" />

        <KpiCard title="Sudah Tindak Lanjut" value={data.sudahTl} icon="↗" />

        <KpiCard title="Sudah Tuntas" value={data.sudahTuntas} icon="✓" />
      </View>

      {/* BPK */}

      <Text style={styles.sectionTitle}>BPK Monitoring</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Badan Pemeriksa Keuangan</Text>

            <Text style={styles.cardSubtitle}>
              Total {data.bpk.total} rekomendasi
            </Text>
          </View>

          <View style={styles.bpkBadge}>
            <Text style={styles.bpkBadgeText}>BPK</Text>
          </View>
        </View>

        <View style={styles.saldoHeader}>
          <Text style={styles.saldoTitle}>Persentase Saldo</Text>

          <Text style={styles.saldoPercentage}>
            {data.bpk.persentaseSaldo}%
          </Text>
        </View>

        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  Math.max(data.bpk.persentaseSaldo, 0),
                  100
                )}%`,
              },
            ]}
          />
        </View>

        <View style={styles.statusRow}>
          <StatusBox
            title="Masuk Saldo"
            value={data.bpk.masukSaldo}
            type="green"
          />

          <StatusBox
            title="Belum Saldo"
            value={data.bpk.belumSaldo}
            type="red"
          />
        </View>

        <View style={styles.categoryContainer}>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryLabel}>Laporan Keuangan</Text>

            <Text style={styles.categoryValue}>{data.bpk.keuangan}</Text>
          </View>

          <View style={styles.categoryItem}>
            <Text style={styles.categoryLabel}>Bukan Keuangan</Text>

            <Text style={styles.categoryValue}>{data.bpk.bukanKeuangan}</Text>
          </View>
        </View>
      </View>

      {/* ITJEN */}

      <Text style={styles.sectionTitle}>Itjen Monitoring</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Inspektorat Jenderal</Text>

            <Text style={styles.cardSubtitle}>
              Total {data.itjen.total} rekomendasi
            </Text>
          </View>

          <View style={styles.itjenBadge}>
            <Text style={styles.itjenBadgeText}>ITJEN</Text>
          </View>
        </View>

        <StatusRow
          title="Sudah Tuntas"
          value={data.itjen.selesai}
          type="green"
        />

        <StatusRow
          title="Sudah Tindak Lanjut"
          value={data.itjen.proses}
          type="gold"
        />

        <StatusRow
          title="Belum Tindak Lanjut"
          value={data.itjen.belum}
          type="red"
        />
      </View>

      {/* RECENT ACTIVITY */}

      <Text style={styles.sectionTitle}>Rekomendasi Terbaru</Text>

      <View style={styles.card}>
        {recommendations.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada data rekomendasi.</Text>
        ) : (
          recommendations
            .slice(0, 5)
            .map((item) => <RecommendationRow key={item.id} item={item} />)
        )}
      </View>

      <Footer />
    </>
  );
}

/* =========================================================
   REKOMENDASI
========================================================= */

function RecommendationContent({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageIntro}>
        <Text style={styles.pageIntroTitle}>Data Rekomendasi</Text>

        <Text style={styles.pageIntroText}>
          Daftar rekomendasi pemeriksaan BPK dan Itjen.
        </Text>
      </View>

      <View style={styles.totalRecommendationCard}>
        <View>
          <Text style={styles.totalRecommendationLabel}>TOTAL REKOMENDASI</Text>

          <Text style={styles.totalRecommendationValue}>
            {recommendations.length}
          </Text>
        </View>

        <View style={styles.totalIcon}>
          <Text style={styles.totalIconText}>▣</Text>
        </View>
      </View>

      {recommendations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>▣</Text>

          <Text style={styles.emptyTitle}>Belum Ada Rekomendasi</Text>

          <Text style={styles.emptyText}>
            Data rekomendasi belum tersedia dari server.
          </Text>
        </View>
      ) : (
        recommendations.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))
      )}

      <Footer />
    </View>
  );
}

/* =========================================================
   LAPORAN
========================================================= */

function ReportContent({
  data,
  recommendations,
}: {
  data: DashboardData;
  recommendations: Recommendation[];
}) {
  const bpkCount = recommendations.filter(
    (item) => item.source === "BPK"
  ).length;

  const itjenCount = recommendations.filter(
    (item) => item.source === "ITJEN" || item.source === "Itjen"
  ).length;

  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageIntro}>
        <Text style={styles.pageIntroTitle}>Laporan APF</Text>

        <Text style={styles.pageIntroText}>
          Ringkasan monitoring tindak lanjut rekomendasi.
        </Text>
      </View>

      {/* RINGKASAN */}

      <Text style={styles.reportSectionTitle}>Ringkasan Umum</Text>

      <View style={styles.reportGrid}>
        <ReportCard title="Total" value={data.total} icon="▣" />

        <ReportCard title="Belum TL" value={data.belumTl} icon="!" />

        <ReportCard title="Sudah TL" value={data.sudahTl} icon="↗" />

        <ReportCard title="Tuntas" value={data.sudahTuntas} icon="✓" />
      </View>

      {/* SUMBER */}

      <Text style={styles.reportSectionTitle}>Berdasarkan Sumber</Text>

      <View style={styles.reportCardLarge}>
        <ReportSourceRow title="BPK" value={data.bpk.total} color="#071426" />

        <ReportSourceRow
          title="Itjen"
          value={data.itjen.total}
          color="#D4A72C"
        />
      </View>

      {/* DATA AKTUAL API */}

      <Text style={styles.reportSectionTitle}>Data Rekomendasi</Text>

      <View style={styles.reportCardLarge}>
        <ReportSourceRow
          title="BPK dari API"
          value={bpkCount}
          color="#071426"
        />

        <ReportSourceRow
          title="Itjen dari API"
          value={itjenCount}
          color="#D4A72C"
        />

        <ReportSourceRow
          title="Total Data API"
          value={recommendations.length}
          color="#16A34A"
        />
      </View>

      {/* SALDO */}

      <Text style={styles.reportSectionTitle}>Monitoring Saldo BPK</Text>

      <View style={styles.reportCardLarge}>
        <View style={styles.reportSaldoHeader}>
          <Text style={styles.reportSaldoLabel}>Persentase Saldo</Text>

          <Text style={styles.reportSaldoValue}>
            {data.bpk.persentaseSaldo}%
          </Text>
        </View>

        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  Math.max(data.bpk.persentaseSaldo, 0),
                  100
                )}%`,
              },
            ]}
          />
        </View>

        <View style={styles.reportSaldoNumbers}>
          <Text style={styles.reportSaldoGreen}>
            Masuk Saldo: {data.bpk.masukSaldo}
          </Text>

          <Text style={styles.reportSaldoRed}>
            Belum Saldo: {data.bpk.belumSaldo}
          </Text>
        </View>
      </View>

      <Footer />
    </View>
  );
}

/* =========================================================
   SIDEBAR MENU
========================================================= */

function MenuItem({
  icon,
  title,
  active,
  onPress,
}: {
  icon: string;
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
    >
      <Text style={[styles.menuIcon, active && styles.menuIconActive]}>
        {icon}
      </Text>

      <Text style={[styles.menuText, active && styles.menuTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

/* =========================================================
   KPI
========================================================= */

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIcon}>
        <Text style={styles.kpiIconText}>{icon}</Text>
      </View>

      <Text style={styles.kpiValue}>{value}</Text>

      <Text style={styles.kpiTitle}>{title}</Text>
    </View>
  );
}

/* =========================================================
   STATUS BOX
========================================================= */

function StatusBox({
  title,
  value,
  type,
}: {
  title: string;
  value: number;
  type: "green" | "red";
}) {
  return (
    <View style={styles.statusBox}>
      <View
        style={[styles.statusDot, type === "green" ? styles.green : styles.red]}
      />

      <View style={styles.statusContent}>
        <Text style={styles.statusTitle}>{title}</Text>

        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

/* =========================================================
   STATUS ROW
========================================================= */

function StatusRow({
  title,
  value,
  type,
}: {
  title: string;
  value: number;
  type: "green" | "red" | "gold";
}) {
  return (
    <View style={styles.statusRowItem}>
      <View
        style={[
          styles.statusDot,
          type === "green"
            ? styles.green
            : type === "red"
            ? styles.red
            : styles.gold,
        ]}
      />

      <Text style={styles.statusRowTitle}>{title}</Text>

      <Text style={styles.statusRowValue}>{value}</Text>
    </View>
  );
}

/* =========================================================
   RECOMMENDATION ROW
========================================================= */

function RecommendationRow({ item }: { item: Recommendation }) {
  return (
    <View style={styles.recommendationRow}>
      <View style={styles.recommendationSource}>
        <Text style={styles.recommendationSourceText}>{item.source}</Text>
      </View>

      <View style={styles.recommendationInfo}>
        <Text style={styles.recommendationNumber}>{item.lha_number}</Text>

        <Text style={styles.recommendationCategory}>{item.category}</Text>
      </View>

      <View style={styles.recommendationStatus}>
        <Text style={styles.recommendationStatusText}>
          {formatStatus(item.follow_up_status)}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   RECOMMENDATION CARD
========================================================= */

function RecommendationCard({ item }: { item: Recommendation }) {
  return (
    <View style={styles.recommendationCard}>
      <View style={styles.recommendationCardTop}>
        <View
          style={[
            styles.sourceBadge,
            item.source === "BPK" ? styles.sourceBpk : styles.sourceItjen,
          ]}
        >
          <Text
            style={[
              styles.sourceBadgeText,
              item.source === "BPK"
                ? styles.sourceBpkText
                : styles.sourceItjenText,
            ]}
          >
            {item.source}
          </Text>
        </View>

        <Text style={styles.recommendationId}>#{item.id}</Text>
      </View>

      <Text style={styles.recommendationCardTitle}>{item.lha_number}</Text>

      <Text style={styles.recommendationCardCategory}>{item.category}</Text>

      <View style={styles.recommendationDetailRow}>
        <Text style={styles.detailLabel}>Tanggal LHA</Text>

        <Text style={styles.detailValue}>{item.lha_date}</Text>
      </View>

      <View style={styles.recommendationDetailRow}>
        <Text style={styles.detailLabel}>Jumlah Rekomendasi</Text>

        <Text style={styles.detailValue}>{item.recommendation_count}</Text>
      </View>

      <View style={styles.recommendationDetailRow}>
        <Text style={styles.detailLabel}>Status</Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {formatStatus(item.follow_up_status)}
          </Text>
        </View>
      </View>

      <View style={styles.recommendationDetailRow}>
        <Text style={styles.detailLabel}>Saldo</Text>

        <Text style={styles.detailValue}>{formatSaldo(item.saldo_status)}</Text>
      </View>

      {item.description ? (
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionLabel}>Keterangan</Text>

          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* =========================================================
   REPORT CARD
========================================================= */

function ReportCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportIcon}>
        <Text style={styles.reportIconText}>{icon}</Text>
      </View>

      <Text style={styles.reportValue}>{value}</Text>

      <Text style={styles.reportTitle}>{title}</Text>
    </View>
  );
}

function ReportSourceRow({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.reportSourceRow}>
      <View
        style={[
          styles.reportSourceDot,
          {
            backgroundColor: color,
          },
        ]}
      />

      <Text style={styles.reportSourceTitle}>{title}</Text>

      <Text style={styles.reportSourceValue}>{value}</Text>
    </View>
  );
}

/* =========================================================
   FOOTER
========================================================= */

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerTitle}>APF Monitoring Center</Text>

      <Text style={styles.footerText}>Bea Cukai Soekarno-Hatta • 2026</Text>
    </View>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatStatus(status: string) {
  switch (status) {
    case "BELUM_TL":
      return "Belum Tindak Lanjut";

    case "SUDAH_TL":
      return "Sudah Tindak Lanjut";

    case "SUDAH_TUNTAS":
      return "Sudah Tuntas";

    case "BELUM_TUNTAS":
      return "Belum Tuntas";

    default:
      return status;
  }
}

function formatSaldo(status: string) {
  switch (status) {
    case "MASUK_SALDO":
      return "Masuk Saldo";

    case "BELUM_SALDO":
      return "Belum Saldo";

    case "TIDAK_RELEVAN":
      return "Tidak Relevan";

    default:
      return status;
  }
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  /* =====================================================
     BACKGROUND
  ====================================================== */

  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  background: {
    flex: 1,
  },

  /*
   * Foto Bea Cukai dibuat sangat samar.
   * Nilai 0.14 = 14% opacity.
   */
  backgroundImage: {
    opacity: 0.14,
  },

  /*
   * Layer putih kebiruan di atas foto.
   * Membuat background terlihat seperti watermark.
   */
  backgroundOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(244, 247, 251, 0.86)",
    zIndex: 0,
  },

  /*
   * Semua konten utama berada di atas overlay.
   */
  mainContent: {
    flex: 1,
    zIndex: 1,
  },

  /* =====================================================
     LOADING
  ====================================================== */

  loadingContainer: {
    flex: 1,
    backgroundColor: "#071426",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 14,
  },

  /* =====================================================
     ERROR
  ====================================================== */

  errorContainer: {
    flex: 1,
    backgroundColor: "#071426",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  errorIconText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },

  errorTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 20,
  },

  errorText: {
    color: "#AEB9C8",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },

  retryButton: {
    marginTop: 25,
    backgroundColor: "#D4A72C",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
  },

  retryButtonText: {
    color: "#071426",
    fontWeight: "900",
  },

  /* =====================================================
     SIDEBAR OVERLAY
  ====================================================== */

  overlay: {
    position: "absolute",
    zIndex: 20,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  /* =====================================================
     SIDEBAR
  ====================================================== */

  sidebar: {
    position: "absolute",
    zIndex: 30,
    left: 0,
    top: 0,
    bottom: 0,
    width: 285,
    backgroundColor: "#071426",
    paddingTop: 55,
    paddingHorizontal: 20,
    elevation: 20,
  },

  sidebarOpen: {
    transform: [{ translateX: 0 }],
  },

  sidebarClosed: {
    transform: [{ translateX: -310 }],
  },

  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sidebarBrand: {
    color: "#D4A72C",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 2,
  },

  sidebarTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#102641",
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "300",
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: "#1B314D",
    marginVertical: 30,
  },

  menuLabel: {
    color: "#718096",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 13,
    borderRadius: 13,
    marginBottom: 6,
  },

  menuItemActive: {
    backgroundColor: "#D4A72C",
  },

  menuIcon: {
    width: 30,
    color: "#AEB9C8",
    fontSize: 19,
    textAlign: "center",
  },

  menuIconActive: {
    color: "#071426",
  },

  menuText: {
    color: "#AEB9C8",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },

  menuTextActive: {
    color: "#071426",
    fontWeight: "900",
  },

  sidebarBottom: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 30,
  },

  sidebarInfo: {
    flexDirection: "row",
    backgroundColor: "#102641",
    padding: 12,
    borderRadius: 13,
    alignItems: "center",
    marginBottom: 12,
  },

  sidebarOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 10,
  },

  sidebarOnlineTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  sidebarOnlineText: {
    color: "#718096",
    fontSize: 8,
    marginTop: 3,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#263B54",
    borderRadius: 12,
    paddingVertical: 12,
  },

  logoutIcon: {
    color: "#DC2626",
    fontSize: 18,
    marginRight: 8,
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  /* =====================================================
     HEADER
  ====================================================== */

  header: {
    backgroundColor: "rgba(7, 20, 38, 0.98)",
    paddingTop: 55,
    paddingBottom: 24,
    paddingHorizontal: 18,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#102641",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  menuButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
  },

  headerTitleContainer: {
    flex: 1,
  },

  brand: {
    color: "#D4A72C",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 3,
  },

  headerSubtitle: {
    color: "#AEB9C8",
    fontSize: 10,
    marginTop: 2,
  },

  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#102641",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 5,
  },

  onlineText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },

  /* =====================================================
     HERO
  ====================================================== */

  heroCard: {
    margin: 18,
    padding: 21,
    borderRadius: 22,
    backgroundColor: "#0B1F3A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  heroContent: {
    flex: 1,
  },

  heroLabel: {
    color: "#D4A72C",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  heroValue: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "900",
    marginTop: 3,
  },

  heroDescription: {
    color: "#AEB9C8",
    fontSize: 10,
    lineHeight: 16,
    maxWidth: 200,
  },

  heroCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: "#D4A72C",
    alignItems: "center",
    justifyContent: "center",
  },

  heroCircleValue: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  heroCircleLabel: {
    color: "#AEB9C8",
    fontSize: 7,
    marginTop: 2,
  },

  /* =====================================================
     SECTION
  ====================================================== */

  sectionTitle: {
    color: "#071426",
    fontSize: 18,
    fontWeight: "900",
    marginHorizontal: 18,
    marginBottom: 12,
    marginTop: 4,
  },

  /* =====================================================
     KPI
  ====================================================== */

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  kpiCard: {
    width: "46%",
    marginHorizontal: "2%",
    marginBottom: 12,
    minHeight: 125,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 16,
  },

  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFF7DD",
    alignItems: "center",
    justifyContent: "center",
  },

  kpiIconText: {
    color: "#D4A72C",
    fontSize: 14,
    fontWeight: "900",
  },

  kpiValue: {
    color: "#071426",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 12,
  },

  kpiTitle: {
    color: "#718096",
    fontSize: 10,
    marginTop: 3,
  },

  /* =====================================================
     CARD
  ====================================================== */

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 20,
    borderRadius: 20,
    padding: 18,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  cardTitle: {
    color: "#071426",
    fontSize: 14,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: "#8A96A8",
    fontSize: 10,
    marginTop: 4,
  },

  bpkBadge: {
    backgroundColor: "#071426",
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  bpkBadgeText: {
    color: "#D4A72C",
    fontSize: 9,
    fontWeight: "900",
  },

  itjenBadge: {
    backgroundColor: "#D4A72C",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  itjenBadgeText: {
    color: "#071426",
    fontSize: 9,
    fontWeight: "900",
  },

  /* =====================================================
     SALDO
  ====================================================== */

  saldoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  saldoTitle: {
    color: "#536174",
    fontSize: 11,
    fontWeight: "700",
  },

  saldoPercentage: {
    color: "#D4A72C",
    fontSize: 18,
    fontWeight: "900",
  },

  progressBackground: {
    height: 9,
    backgroundColor: "#E8EDF3",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#D4A72C",
    borderRadius: 10,
  },

  /* =====================================================
     STATUS
  ====================================================== */

  statusRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },

  statusBox: {
    flex: 1,
    backgroundColor: "#F4F7FB",
    borderRadius: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  statusContent: {
    flex: 1,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },

  green: {
    backgroundColor: "#16A34A",
  },

  red: {
    backgroundColor: "#DC2626",
  },

  gold: {
    backgroundColor: "#D4A72C",
  },

  statusTitle: {
    color: "#718096",
    fontSize: 9,
  },

  statusValue: {
    color: "#071426",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },

  statusRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F5",
  },

  statusRowTitle: {
    color: "#536174",
    fontSize: 11,
    flex: 1,
  },

  statusRowValue: {
    color: "#071426",
    fontSize: 15,
    fontWeight: "900",
  },

  /* =====================================================
     CATEGORY
  ====================================================== */

  categoryContainer: {
    flexDirection: "row",
    backgroundColor: "#F4F7FB",
    borderRadius: 13,
    padding: 13,
    marginTop: 12,
  },

  categoryItem: {
    flex: 1,
  },

  categoryLabel: {
    color: "#718096",
    fontSize: 9,
  },

  categoryValue: {
    color: "#071426",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },

  /* =====================================================
     PAGE
  ====================================================== */

  pageContainer: {
    paddingTop: 20,
  },

  pageIntro: {
    paddingHorizontal: 18,
    marginBottom: 16,
  },

  pageIntroTitle: {
    color: "#071426",
    fontSize: 21,
    fontWeight: "900",
  },

  pageIntroText: {
    color: "#718096",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  /* =====================================================
     RECOMMENDATION
  ====================================================== */

  totalRecommendationCard: {
    marginHorizontal: 18,
    backgroundColor: "#0B1F3A",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  totalRecommendationLabel: {
    color: "#D4A72C",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  totalRecommendationValue: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "900",
    marginTop: 3,
  },

  totalIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: "#102641",
    alignItems: "center",
    justifyContent: "center",
  },

  totalIconText: {
    color: "#D4A72C",
    fontSize: 24,
  },

  recommendationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F5",
  },

  recommendationSource: {
    width: 50,
    backgroundColor: "#071426",
    borderRadius: 7,
    paddingVertical: 6,
    alignItems: "center",
  },

  recommendationSourceText: {
    color: "#D4A72C",
    fontSize: 8,
    fontWeight: "900",
  },

  recommendationInfo: {
    flex: 1,
    marginLeft: 10,
  },

  recommendationNumber: {
    color: "#071426",
    fontSize: 10,
    fontWeight: "900",
  },

  recommendationCategory: {
    color: "#718096",
    fontSize: 8,
    marginTop: 3,
  },

  recommendationStatus: {
    maxWidth: 90,
  },

  recommendationStatusText: {
    color: "#536174",
    fontSize: 8,
    textAlign: "right",
  },

  recommendationCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    padding: 17,
  },

  recommendationCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sourceBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  sourceBpk: {
    backgroundColor: "#071426",
  },

  sourceItjen: {
    backgroundColor: "#FFF4CC",
  },

  sourceBadgeText: {
    fontSize: 8,
    fontWeight: "900",
  },

  sourceBpkText: {
    color: "#D4A72C",
  },

  sourceItjenText: {
    color: "#071426",
  },

  recommendationId: {
    color: "#A0A9B7",
    fontSize: 9,
  },

  recommendationCardTitle: {
    color: "#071426",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 15,
  },

  recommendationCardCategory: {
    color: "#718096",
    fontSize: 10,
    marginTop: 4,
  },

  recommendationDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F5",
  },

  detailLabel: {
    color: "#718096",
    fontSize: 10,
  },

  detailValue: {
    color: "#071426",
    fontSize: 10,
    fontWeight: "800",
    maxWidth: "55%",
    textAlign: "right",
  },

  statusPill: {
    backgroundColor: "#FFF7DD",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  statusPillText: {
    color: "#9A7511",
    fontSize: 8,
    fontWeight: "800",
  },

  descriptionBox: {
    backgroundColor: "#F4F7FB",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },

  descriptionLabel: {
    color: "#536174",
    fontSize: 9,
    fontWeight: "900",
  },

  descriptionText: {
    color: "#718096",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 4,
  },

  /* =====================================================
     EMPTY
  ====================================================== */

  emptyCard: {
    marginHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 35,
    alignItems: "center",
  },

  emptyIcon: {
    color: "#D4A72C",
    fontSize: 35,
  },

  emptyTitle: {
    color: "#071426",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },

  emptyText: {
    color: "#718096",
    fontSize: 10,
    textAlign: "center",
    marginTop: 5,
  },

  /* =====================================================
     REPORT
  ====================================================== */

  reportSectionTitle: {
    color: "#071426",
    fontSize: 17,
    fontWeight: "900",
    marginHorizontal: 18,
    marginBottom: 12,
    marginTop: 8,
  },

  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  reportCard: {
    width: "46%",
    marginHorizontal: "2%",
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
    minHeight: 115,
  },

  reportIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#FFF7DD",
    alignItems: "center",
    justifyContent: "center",
  },

  reportIconText: {
    color: "#D4A72C",
    fontWeight: "900",
  },

  reportValue: {
    color: "#071426",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 10,
  },

  reportTitle: {
    color: "#718096",
    fontSize: 9,
    marginTop: 3,
  },

  reportCardLarge: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 18,
    padding: 17,
    marginBottom: 20,
  },

  reportSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F5",
  },

  reportSourceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
  },

  reportSourceTitle: {
    color: "#536174",
    fontSize: 11,
    flex: 1,
  },

  reportSourceValue: {
    color: "#071426",
    fontSize: 15,
    fontWeight: "900",
  },

  reportSaldoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  reportSaldoLabel: {
    color: "#536174",
    fontSize: 11,
    fontWeight: "700",
  },

  reportSaldoValue: {
    color: "#D4A72C",
    fontSize: 18,
    fontWeight: "900",
  },

  reportSaldoNumbers: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  reportSaldoGreen: {
    color: "#16A34A",
    fontSize: 9,
    fontWeight: "800",
  },

  reportSaldoRed: {
    color: "#DC2626",
    fontSize: 9,
    fontWeight: "800",
  },

  /* =====================================================
     FOOTER
  ====================================================== */

  footer: {
    alignItems: "center",
    paddingVertical: 30,
  },

  footerTitle: {
    color: "#D4A72C",
    fontSize: 10,
    fontWeight: "800",
  },

  footerText: {
    color: "#8A96A8",
    fontSize: 9,
    marginTop: 4,
  },
});
