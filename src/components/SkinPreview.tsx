import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SKINS } from '../lib/skins';

interface SkinPreviewProps {
  activeSkinId: string;
  onSelect: (skinId: string) => void;
  onClose: () => void;
}

export const SkinPreview: React.FC<SkinPreviewProps> = ({
  activeSkinId,
  onSelect,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const scale = Math.min(1, height / 400);
  const s = (v: number) => Math.round(v * scale);

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.modal,
          {
            paddingHorizontal: s(24),
            paddingVertical: s(20),
            borderRadius: s(20),
          },
        ]}
      >
        {/* Header */}
        <Text style={[styles.title, { fontSize: s(18), marginBottom: s(4) }]}>
          SKINS
        </Text>
        <Text style={[styles.subtitle, { fontSize: s(11), marginBottom: s(16) }]}>
          Watch an ad to unlock a skin for 24 hours
        </Text>

        {/* Skin Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { gap: s(12) }]}
        >
          {SKINS.map((skin) => {
            const isActive = skin.id === activeSkinId;
            const isDefault = skin.id === 'default';

            return (
              <Pressable
                key={skin.id}
                style={({ pressed }) => [
                  styles.skinCard,
                  {
                    width: s(76),
                    paddingVertical: s(12),
                    paddingHorizontal: s(8),
                    borderRadius: s(12),
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? skin.body : 'rgba(0,0,0,0.1)',
                  },
                  pressed && styles.cardPressed,
                  isActive && { backgroundColor: `${skin.body}18` },
                ]}
                onPress={() => {
                  if (!isActive) {
                    onSelect(skin.id);
                  }
                }}
              >
                {/* Flamingo silhouette */}
                <View style={[styles.silhouette, { height: s(60) }]}>
                  {/* Body (large circle) */}
                  <View
                    style={[
                      styles.bodyCircle,
                      {
                        width: s(32),
                        height: s(32),
                        borderRadius: s(16),
                        backgroundColor: skin.body,
                        top: s(14),
                        alignSelf: 'center',
                      },
                    ]}
                  />
                  {/* Head (small circle) */}
                  <View
                    style={[
                      styles.headCircle,
                      {
                        width: s(16),
                        height: s(16),
                        borderRadius: s(8),
                        backgroundColor: skin.bodyLight,
                        top: s(4),
                        alignSelf: 'center',
                      },
                    ]}
                  />
                  {/* Leg */}
                  <View
                    style={[
                      styles.leg,
                      {
                        width: s(5),
                        height: s(16),
                        borderRadius: s(2),
                        backgroundColor: skin.legs,
                        bottom: s(0),
                        alignSelf: 'center',
                      },
                    ]}
                  />
                </View>

                {/* Skin name */}
                <Text
                  style={[
                    styles.skinName,
                    { fontSize: s(10), marginTop: s(6), color: skin.body },
                  ]}
                >
                  {skin.name.toUpperCase()}
                </Text>

                {/* Status label */}
                <View
                  style={[
                    styles.labelBadge,
                    {
                      backgroundColor: isActive
                        ? skin.body
                        : isDefault
                        ? '#4CAF50'
                        : 'rgba(0,0,0,0.08)',
                      borderRadius: s(8),
                      paddingHorizontal: s(4),
                      paddingVertical: s(2),
                      marginTop: s(4),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.labelText,
                      {
                        fontSize: s(9),
                        color: isActive || isDefault ? '#fff' : '#666',
                      },
                    ]}
                  >
                    {isActive ? 'ACTIVE' : isDefault ? 'FREE' : 'Watch Ad'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Close Button */}
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            {
              paddingHorizontal: s(40),
              paddingVertical: s(10),
              borderRadius: s(24),
              marginTop: s(16),
            },
            pressed && styles.cardPressed,
          ]}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { fontSize: s(13) }]}>
            CLOSE
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#9C27B0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontWeight: '900',
    color: '#9C27B0',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#888',
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  skinCard: {
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  silhouette: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  bodyCircle: {
    position: 'absolute',
  },
  headCircle: {
    position: 'absolute',
  },
  leg: {
    position: 'absolute',
  },
  skinName: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  labelBadge: {
    alignItems: 'center',
  },
  labelText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeButton: {
    backgroundColor: '#9C27B0',
    borderWidth: 2,
    borderColor: '#BA68C8',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 2,
  },
});
