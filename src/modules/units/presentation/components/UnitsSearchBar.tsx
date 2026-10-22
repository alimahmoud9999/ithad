import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface UnitsSearchBarProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setAddModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const UnitsSearchBar: React.FC<UnitsSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  setAddModalVisible,
}) => {
  return (
    <View style={styles.rowAlign}>
      <View style={styles.searchBarWrapper}>
        <MaterialIcons name="search" size={20} color={COLORS.onSurfaceVariant} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInputField}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="بحث برقم الشقة، الدور، أو اسم الساكن..."
          placeholderTextColor={COLORS.outline}
        />
      </View>
      <TouchableOpacity
        style={styles.addUnitTopBtn}
        onPress={() => setAddModalVisible(true)}
      >
        <MaterialIcons name="add" size={20} color={COLORS.onPrimary} />
        <Text style={styles.addUnitTopBtnText}>إضافة</Text>
      </TouchableOpacity>
    </View>
  );
};
