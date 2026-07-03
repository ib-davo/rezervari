"use client";

import { Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

interface PhoneButtonProps {
  phone: string;
  label?: string;
  showIcon?: boolean;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

export function PhoneButton({
  phone,
  label,
  showIcon = true,
  variant = "primary",
  className = "",
}: PhoneButtonProps) {
  const formattedPhone = phone.replace(/\s/g, "");

  const variants = {
    primary: "bg-green-500 hover:bg-green-600 text-white",
    secondary: "bg-gray-800 hover:bg-gray-900 text-white",
    outline: "border-2 border-green-500 text-green-500 hover:bg-green-50",
  };

  return (
    <motion.a
      href={`tel:${formattedPhone}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${variants[variant]} ${className}`}
    >
      {showIcon && <Phone className="h-4 w-4" />}
      {label || phone}
    </motion.a>
  );
}

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

export function WhatsAppButton({
  phone,
  message = "Salut! Aș dori informații despre cursele DAVO.",
  label = "WhatsApp",
  variant = "primary",
  className = "",
}: WhatsAppButtonProps) {
  const formattedPhone = phone.replace(/[+\s]/g, "");
  const encodedMessage = encodeURIComponent(message);

  const variants = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    secondary: "bg-gray-800 hover:bg-gray-900 text-white",
    outline: "border-2 border-green-600 text-green-600 hover:bg-green-50",
  };

  return (
    <motion.a
      href={`https://wa.me/${formattedPhone}?text=${encodedMessage}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${variants[variant]} ${className}`}
    >
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.472.099-.173.05-.324-.025-.473-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      {label}
    </motion.a>
  );
}

export function TelegramButton({ phone }: { phone: string }) {
  const formattedPhone = phone.replace(/[+\s]/g, "");

  return (
    <motion.a
      href={`https://t.me/+${formattedPhone}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-[#0088cc] text-white hover:bg-[#0077b3] transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
      Telegram
    </motion.a>
  );
}

export function ViberButton({ phone }: { phone: string }) {
  const formattedPhone = phone.replace(/[+\s]/g, "");

  return (
    <motion.a
      href={`viber://chat?number=${formattedPhone}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-[#7360f2] text-white hover:bg-[#604ee0] transition-colors"
    >
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.554 4.18 1.604 6.006L.57 23.294c-.147.434.248.829.683.683l5.29-2.033A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm6.067 16.394c-.642 1.14-2.01 1.79-3.42 1.79-.29 0-.58-.028-.867-.083-.533-.098-1.08-.25-1.64-.455-.774-.28-1.566-.654-2.354-1.11-.947-.555-1.874-1.225-2.754-1.992-1.067-.915-2.01-1.99-2.696-3.128-.576-.958-.99-1.948-1.234-2.944-.174-.706-.243-1.405-.206-2.08.033-.592.174-1.166.416-1.7.263-.576.67-1.08 1.19-1.46.392-.287.838-.456 1.296-.49.16-.01.32-.006.48.014.2.024.4.094.574.2.24.147.448.35.608.583.16.233.306.477.44.72.16.28.303.568.423.85.08.186.146.377.2.57.066.246.07.508.01.756a1.6 1.6 0 01-.32.64c-.18.22-.407.398-.653.51-.12.05-.245.086-.373.11a.986.986 0 01-.273.013.906.906 0 01-.206-.047.89.89 0 00-.18-.046c-.087-.014-.167 0-.247.047-.12.074-.213.187-.273.32-.047.107-.067.227-.06.346.053.493.26.96.587 1.327.347.387.78.7 1.26.914.267.127.554.207.847.234.14.013.28 0 .42-.04.107-.033.2-.093.274-.174.067-.074.107-.167.12-.267.013-.08.02-.16.02-.24 0-.06-.007-.12-.02-.18a.715.715 0 00-.133-.34 1.006 1.006 0 00-.374-.306c-.186-.1-.4-.16-.614-.173-.1-.007-.2 0-.3.02-.106.026-.206.067-.3.12-.08.047-.174.08-.267.1a.585.585 0 01-.28-.006c-.12-.027-.226-.1-.3-.2-.08-.107-.12-.233-.113-.36.006-.14.046-.273.12-.386.16-.233.373-.423.62-.554.26-.14.546-.22.84-.233.14-.007.28.007.42.04.2.04.387.12.554.234.2.133.373.306.507.507.147.22.246.473.293.733.04.246.027.493-.04.733-.067.24-.18.46-.333.653-.16.2-.36.367-.587.493-.247.133-.52.213-.8.24-.253.026-.5.006-.747-.053-.4-.1-.78-.267-1.127-.494-.36-.24-.687-.527-.973-.853-.293-.333-.54-.7-.727-1.093a4.6 4.6 0 01-.42-1.34c-.04-.233-.04-.473-.007-.713.033-.233.1-.46.2-.68.107-.226.253-.427.427-.594.167-.16.36-.287.567-.38.2-.093.42-.146.64-.16.247-.013.493.02.72.1.28.093.533.24.747.427.2.174.36.387.48.62.1.207.173.427.206.653.027.213.02.427-.02.64z"/>
      </svg>
      Viber
    </motion.a>
  );
}
