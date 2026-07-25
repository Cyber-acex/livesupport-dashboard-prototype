import { motion } from 'framer-motion';
import { useVoiceCommunication } from '../contexts/VoiceCommunicationContext';

export default function VoiceCommunicationLauncher() {
  const { isOpen, togglePanel, incomingCall } = useVoiceCommunication();

  return (
    <motion.button
      type="button"
      onClick={togglePanel}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      className={`fixed bottom-5 right-5 z-[85] flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-sky-500 via-cyan-500 to-violet-500 text-3xl text-white shadow-[0_24px_70px_rgba(14,165,233,0.32)] backdrop-blur-xl transition-all ${incomingCall ? 'animate-[pulse_1.4s_ease-in-out_infinite]' : ''}`}
      aria-label={isOpen ? 'Close voice communication panel' : 'Open voice communication panel'}
    >
      🎤
    </motion.button>
  );
}
