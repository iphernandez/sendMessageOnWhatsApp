import pywhatkit as kit

def sendScheduleMessage(groupName, message, hour, minute):
    # Send the message
    kit.sendwhatmsg_to_group(groupName, message, hour, minute)

def sendMessage(groupName, message):
    kit.sendwhatmsg_to_group_instantly(groupName, message)