import os
import os.path

def readFileToText(filename):
    cwd = os.getcwd()
    filePath=cwd+"\\"+filename
    print("Reading file: %s" % (filePath))
    if os.path.isfile(filePath):
        with open(filePath, "r") as f:
            text = f.read()
        return text
    else:
        raise Exception("File %s not found" % (filePath))