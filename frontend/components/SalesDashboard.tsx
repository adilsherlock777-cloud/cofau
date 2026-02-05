import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const SCREEN_WIDTH = Dimensions.get("window").width;

interface SalesDashboardProps {
  token: string;
}

interface SalesMetrics {
  totalSales: number;
  totalOrders: number;
  weekGrowth: number;
  monthGrowth: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  ordersLastWeek: number;
  ordersLastMonth: number;
  salesThisWeek: number;
  salesThisMonth: number;
  salesLastWeek: number;
  salesLastMonth: number;
  dailySales: { date: string; sales: number; orders: number }[];
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SalesMetrics>({
    totalSales: 0,
    totalOrders: 0,
    weekGrowth: 0,
    monthGrowth: 0,
    ordersThisWeek: 0,
    ordersThisMonth: 0,
    ordersLastWeek: 0,
    ordersLastMonth: 0,
    salesThisWeek: 0,
    salesThisMonth: 0,
    salesLastWeek: 0,
    salesLastMonth: 0,
    dailySales: [],
  });

  useEffect(() => {
    if (token) {
      fetchSalesMetrics();
    }
  }, [token]);

  const fetchSalesMetrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/orders/restaurant/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      setMetrics({
        totalSales: data.total_sales || 0,
        totalOrders: data.total_orders || 0,
        weekGrowth: data.week_growth || 0,
        monthGrowth: data.month_growth || 0,
        ordersThisWeek: data.orders_this_week || 0,
        ordersThisMonth: data.orders_this_month || 0,
        ordersLastWeek: data.orders_last_week || 0,
        ordersLastMonth: data.orders_last_month || 0,
        salesThisWeek: data.sales_this_week || 0,
        salesThisMonth: data.sales_this_month || 0,
        salesLastWeek: data.sales_last_week || 0,
        salesLastMonth: data.sales_last_month || 0,
        dailySales: data.daily_sales || [],
      });
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const renderGrowthIndicator = (growth: number, label: string) => {
    const isPositive = growth >= 0;
    const color = isPositive ? "#4CAF50" : "#FF3B30";
    const icon = isPositive ? "trending-up" : "trending-down";

    return (
      <View style={styles.growthIndicator}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.growthText, { color }]}>
          {isPositive ? "+" : ""}
          {growth.toFixed(1)}%
        </Text>
        <Text style={styles.growthLabel}>{label}</Text>
      </View>
    );
  };

  const renderMiniGraph = (data: { date: string; sales: number; orders: number }[]) => {
    if (data.length === 0) return null;

    const maxSales = Math.max(...data.map((d) => d.sales), 1);
    const graphHeight = 80;
    const barWidth = (SCREEN_WIDTH - 80) / Math.max(data.length, 7);

    return (
      <View style={styles.graphContainer}>
        <Text style={styles.graphTitle}>Last 7 Days Sales Trend</Text>
        <View style={styles.barsContainer}>
          {data.slice(-7).map((item, index) => {
            const barHeight = (item.sales / maxSales) * graphHeight;
            return (
              <View key={index} style={styles.barWrapper}>
                <LinearGradient
                  colors={["#FF8C00", "#FF6B35"]}
                  style={[styles.bar, { height: Math.max(barHeight, 4), width: barWidth - 8 }]}
                />
                <Text style={styles.barLabel}>
                  {new Date(item.date).toLocaleDateString("en-US", { weekday: "short" })[0]}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.graphLegend}>
          <View style={styles.legendItem}>
            <View style={styles.legendColor} />
            <Text style={styles.legendText}>Daily Sales</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.loadingText}>Loading sales data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="analytics" size={28} color="#FF8C00" />
        <Text style={styles.headerTitle}>Sales Dashboard</Text>
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewContainer}>
        {/* Total Sales Card */}
        <View style={styles.overviewCard}>
          <LinearGradient
            colors={["#FF6B35", "#FF8C00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.overviewGradient}
          >
            <Ionicons name="cash-outline" size={32} color="#FFF" />
            <Text style={styles.overviewLabel}>Total Sales</Text>
            <Text style={styles.overviewValue}>{formatCurrency(metrics.totalSales)}</Text>
          </LinearGradient>
        </View>

        {/* Total Orders Card */}
        <View style={styles.overviewCard}>
          <LinearGradient
            colors={["#4CAF50", "#45A049"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.overviewGradient}
          >
            <Ionicons name="receipt-outline" size={32} color="#FFF" />
            <Text style={styles.overviewLabel}>Total Orders</Text>
            <Text style={styles.overviewValue}>{metrics.totalOrders}</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Weekly Performance */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={20} color="#333" />
          <Text style={styles.sectionTitle}>This Week</Text>
        </View>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Orders</Text>
            <Text style={styles.metricValue}>{metrics.ordersThisWeek}</Text>
            <Text style={styles.metricSubtext}>vs {metrics.ordersLastWeek} last week</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sales</Text>
            <Text style={styles.metricValue}>{formatCurrency(metrics.salesThisWeek)}</Text>
            <Text style={styles.metricSubtext}>vs {formatCurrency(metrics.salesLastWeek)}</Text>
          </View>
        </View>
        {renderGrowthIndicator(metrics.weekGrowth, "Growth from last week")}
      </View>

      {/* Monthly Performance */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color="#333" />
          <Text style={styles.sectionTitle}>This Month</Text>
        </View>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Orders</Text>
            <Text style={styles.metricValue}>{metrics.ordersThisMonth}</Text>
            <Text style={styles.metricSubtext}>vs {metrics.ordersLastMonth} last month</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sales</Text>
            <Text style={styles.metricValue}>{formatCurrency(metrics.salesThisMonth)}</Text>
            <Text style={styles.metricSubtext}>vs {formatCurrency(metrics.salesLastMonth)}</Text>
          </View>
        </View>
        {renderGrowthIndicator(metrics.monthGrowth, "Growth from last month")}
      </View>

      {/* Sales Trend Graph */}
      {metrics.dailySales.length > 0 && renderMiniGraph(metrics.dailySales)}

      {/* Average Order Value */}
      {metrics.totalOrders > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color="#333" />
            <Text style={styles.sectionTitle}>Average Order Value</Text>
          </View>
          <Text style={styles.averageValue}>
            {formatCurrency(metrics.totalSales / metrics.totalOrders)}
          </Text>
          <Text style={styles.averageSubtext}>Per order on average</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 12,
  },
  overviewContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewGradient: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  overviewLabel: {
    fontSize: 14,
    color: "#FFF",
    marginTop: 8,
    fontWeight: "500",
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 8,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  metricSubtext: {
    fontSize: 12,
    color: "#999",
  },
  metricDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 16,
  },
  growthIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  growthText: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
    marginRight: 8,
  },
  growthLabel: {
    fontSize: 14,
    color: "#666",
  },
  graphContainer: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 100,
    marginBottom: 8,
  },
  barWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  bar: {
    borderRadius: 4,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  graphLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: "#FF8C00",
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },
  averageValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FF8C00",
    textAlign: "center",
    marginVertical: 8,
  },
  averageSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
