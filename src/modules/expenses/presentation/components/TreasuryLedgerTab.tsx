import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { MainTab, LedgerFilter } from '../../domain/expenses.types';
import { styles } from '../TransparencyExpensesScreen.styles';

interface TreasuryLedgerTabProps {
  activeMainTab: MainTab;
  ledgerFilter: LedgerFilter;
  setLedgerFilter: React.Dispatch<React.SetStateAction<LedgerFilter>>;
  bankBalance: number;
  cashInSafe: number;
  ledgerTransactions: { id: string; title: string; subtext: string; date: string; amount: number; isIncoming: boolean; type: 'collection' | 'expense'; tag: string; }[];
  surplusAmount: number;
  totalCollected: number;
  totalSpent: number;
}

export const TreasuryLedgerTab: React.FC<TreasuryLedgerTabProps> = ({
  activeMainTab,
  ledgerFilter,
  setLedgerFilter,
  bankBalance,
  cashInSafe,
  ledgerTransactions,
  surplusAmount,
  totalCollected,
  totalSpent,
}) => {
  const { currentBuilding } = useAppStore();

  return (
    activeMainTab === 'treasury_ledger' && (
    <>
      {/* Treasury Balance Overview Hero Card (design/_10 lines 37-90) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTopLabel}>إجمالي الرصيد المتاح حالياً</Text>
          <View style={styles.surplusPill}>
            <View style={styles.surplusDot} />
            <Text style={styles.surplusPillText}>حي ومحدث ⚡</Text>
          </View>
        </View>

        <View style={styles.treasuryDisplayRow}>
          <Text style={styles.treasuryTotalNumber}>
            {currentBuilding.fund_balance.toLocaleString()}
          </Text>
          <Text style={styles.treasuryCurrencyText}>ج.م</Text>
        </View>

        {/* Breakdown Split Pills: Cash in Safe vs Bank (design/_10 lines 56-74) */}
        <View style={styles.comparisonGrid}>
          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons name="payments" size={16} color={COLORS.secondaryFixed} />
              <Text style={styles.compLabel}>خزينة البرج النقدية</Text>
            </View>
            <Text style={styles.compCollectedVal}>{cashInSafe.toLocaleString()} ج.م</Text>
            <Text style={styles.compSubDetail}>عهدة كاش مع أمين الصندوق</Text>
          </View>

          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons name="account-balance" size={16} color={COLORS.primaryFixed} />
              <Text style={styles.compLabel}>بنكي / إنستاباي</Text>
            </View>
            <Text style={styles.compCollectedVal}>{bankBalance.toLocaleString()} ج.م</Text>
            <Text style={styles.compSubDetail}>حساب اتحاد الملاك</Text>
          </View>
        </View>

        {/* Monthly Flow Metric Ribbon (design/_10 lines 75-89) */}
        <View style={styles.flowRibbon}>
          <View style={styles.flowRibbonItem}>
            <Text style={styles.flowRibbonLabel}>الوارد الشهري</Text>
            <Text style={styles.flowRibbonValGreen}>
              + {totalCollected.toLocaleString()} ج.م
            </Text>
          </View>
          <View style={styles.flowRibbonDivider} />
          <View style={styles.flowRibbonItem}>
            <Text style={styles.flowRibbonLabel}>المنصرف الشهري</Text>
            <Text style={styles.flowRibbonValRed}>
              - {totalSpent.toLocaleString()} ج.م
            </Text>
          </View>
          <View style={styles.flowRibbonDivider} />
          <View style={styles.flowRibbonItem}>
            <Text style={styles.flowRibbonLabel}>صافي الفائض</Text>
            <Text style={styles.flowRibbonValWhite}>
              + {surplusAmount.toLocaleString()} ج.م
            </Text>
          </View>
        </View>
      </View>

      {/* Financial Audit & Reconciliation Badge (design/_10 lines 91-103) */}
      <View style={styles.reconciliationCard}>
        <View style={styles.reconciliationIcon}>
          <MaterialIcons name="verified-user" size={20} color={COLORS.statusPaid} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.reconciliationTitle}>مطابقة الدفاتر معتمدة حتى اليوم</Text>
          <Text style={styles.reconciliationSub}>
            بتوقيع ومصادقة لجنة المراجعة المالية لـ {currentBuilding.name}
          </Text>
        </View>
        <MaterialIcons name="check-circle" size={20} color={COLORS.statusPaid} />
      </View>

      {/* Transaction Type Filter Tabs */}
      <View style={styles.ledgerFilterRow}>
        <TouchableOpacity
          style={[styles.typePill, ledgerFilter === 'all' && styles.typePillActive]}
          onPress={() => setLedgerFilter('all')}
        >
          <Text
            style={[styles.typePillText, ledgerFilter === 'all' && styles.typePillTextActive]}
          >
            الكل ({ledgerTransactions.length} حركة)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typePill, ledgerFilter === 'incoming' && styles.typePillActive]}
          onPress={() => setLedgerFilter('incoming')}
        >
          <View style={[styles.typePillDot, { backgroundColor: COLORS.statusPaid }]} />
          <Text
            style={[
              styles.typePillText,
              ledgerFilter === 'incoming' && styles.typePillTextActive,
            ]}
          >
            وارد واشتراكات
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typePill, ledgerFilter === 'outgoing' && styles.typePillActive]}
          onPress={() => setLedgerFilter('outgoing')}
        >
          <View style={[styles.typePillDot, { backgroundColor: COLORS.statusUnpaid }]} />
          <Text
            style={[
              styles.typePillText,
              ledgerFilter === 'outgoing' && styles.typePillTextActive,
            ]}
          >
            منصرف وفواتير
          </Text>
        </TouchableOpacity>
      </View>

      {/* Detailed Transaction Log (design/_10 lines 141-260) */}
      <View style={{ gap: 10 }}>
        {ledgerTransactions.map((tx) => (
          <View key={tx.id} style={styles.ledgerTxCard}>
            <View style={styles.txTopRow}>
              <View style={styles.txRightGroup}>
                <View
                  style={[
                    styles.txIconBox,
                    {
                      backgroundColor: tx.isIncoming
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={tx.isIncoming ? 'arrow-downward' : 'arrow-upward'}
                    size={18}
                    color={tx.isIncoming ? COLORS.statusPaid : COLORS.statusUnpaid}
                  />
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <View style={styles.txMetaLine}>
                    <Text style={styles.txSubtext}>{tx.subtext}</Text>
                    <Text style={styles.txDot}>•</Text>
                    <Text style={styles.txDate}>{tx.date}</Text>
                  </View>
                </View>
              </View>

              <Text
                style={[
                  styles.txAmountText,
                  { color: tx.isIncoming ? COLORS.statusPaid : COLORS.statusUnpaid },
                ]}
              >
                {tx.isIncoming ? '+' : '-'} {tx.amount.toLocaleString()} ج.م
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
    )
  ) || null;
};
