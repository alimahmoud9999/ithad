import React from 'react';
import { Modal, View, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from '../CommunityHubScreen.styles';

interface IssueImagePreviewProps {
  selectedIssueImage: string | null;
  setSelectedIssueImage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const IssueImagePreview: React.FC<IssueImagePreviewProps> = ({
  selectedIssueImage,
  setSelectedIssueImage,
}) => {
  return (
    <Modal visible={Boolean(selectedIssueImage)} transparent animationType="fade">
      <View style={styles.imageModalBackdrop}>
        <TouchableOpacity
          style={styles.imageModalCloseBtn}
          onPress={() => setSelectedIssueImage(null)}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        {Boolean(selectedIssueImage) && (
          <Image
            source={{ uri: selectedIssueImage! }}
            style={styles.fullModalImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
};
