import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SuperAdminScreen.styles';

interface SubscriptionActivationsTabProps {
  activeSubTab: 'activations' | 'buildings' | 'plans';
}

export const SubscriptionActivationsTab: React.FC<SubscriptionActivationsTabProps> = ({
  activeSubTab,
}) => {
  const { activateBuildingSubscription, processingIds, subscriptionInvoices } = useAppStore();

  const handleActivateSubscription = async (invoiceId: string) => {
    try {
      await activateBuildingSubscription(invoiceId);
      Alert.alert(
        'تم تفعيل اشتراك العمارة بنجاح 🎉',
        'تم تمديد اشتراك العمارة، وتم إدراج مصروف تلقائي بعنوان "رسوم اشتراك تطبيق إدارة العقار" في سجل الشفافية وخصمه من رصيد الصندوق!'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ أثناء التفعيل');
    }
  };

  return (
    activeSubTab === 'activations' && (
    <View style={{ gap: 12 }}>
      <View style={styles.infoNoticeCard}>
        <MaterialIcons
          name="auto-awesome"
          size={20}
          color={COLORS.secondary}
        />
        <Text style={styles.infoNoticeText}>
          عند الضغط على "تفعيل"، تقوم دالة RPC آمنة بتمديد الاشتراك وإدراج
          مصروف تلقائي في ميزانية العمارة تحت مسمى "رسوم اشتراك تطبيق إدارة
          العقار" ليظهر في الشفافية ويخصم من الصندوق.
        </Text>
      </View>

      {subscriptionInvoices.map((inv) => {
        const isLocked = Boolean(processingIds[inv.id]);
        const isPending = inv.status === 'pending';

        return (
          <View key={inv.id} style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.invoiceBldName}>
                  {inv.building_name} ({inv.building_code})
                </Text>
                <Text style={styles.invoiceAdminSub}>
                  رئيس الاتحاد: {inv.admin_name} • باقة{' '}
                  {inv.plan_code.toUpperCase()} ({inv.duration_months} شهر)
                </Text>
              </View>

              <StatusBadge
                status={inv.status === 'approved' ? 'paid' : 'pending'}
                customLabel={
                  inv.status === 'approved'
                    ? 'تم التفعيل والخصم'
                    : 'بانتظار التفعيل'
                }
              />
            </View>

            <View style={styles.invoiceReceiptBox}>
              <View style={styles.invoiceReceiptRight}>
                <Image
                  source={{ uri: inv.receipt_image_url }}
                  style={styles.invoiceThumb}
                />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.invoiceAmountLabel}>
                    قيمة الباقة المحولة: {inv.amount} ج.م
                  </Text>
                  <Text style={styles.invoiceNotesLabel}>
                    {inv.notes || 'إيصال تحويل إنستاباي مرفوع من المدير'}
                  </Text>
                </View>
              </View>
            </View>

            {isPending ? (
              <TouchableOpacity
                style={[
                  styles.activateCtaBtn,
                  isLocked && { opacity: 0.6 },
                ]}
                onPress={() => handleActivateSubscription(inv.id)}
                disabled={isLocked}
              >
                {isLocked ? (
                  <ActivityIndicator color={COLORS.onSecondary} />
                ) : (
                  <>
                    <MaterialIcons
                      name="bolt"
                      size={20}
                      color={COLORS.onSecondary}
                    />
                    <Text style={styles.activateCtaText}>
                      تفعيل الاشتراك وإدراج المصروف تلقائياً ({inv.amount}{' '}
                      ج.م)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.activatedDoneBar}>
                <MaterialIcons
                  name="check-circle"
                  size={16}
                  color={COLORS.statusPaidText}
                />
                <Text style={styles.activatedDoneText}>
                  تم التفعيل وإدراج مصروف "رسوم اشتراك تطبيق إدارة العقار" في
                  ميزانية العمارة
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
    )
  ) || null;
};
